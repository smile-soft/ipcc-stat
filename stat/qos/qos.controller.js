(function(){

	'use strict';

	angular
		.module('app.qos')
		.controller('QosController', QosController);

	QosController.$inject = ['$rootScope', '$mdDialog', '$q', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function QosController($rootScope, $mdDialog, $q, SettingsService, api, store, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 day'
		};
		var perfStat = [];
		var agentStat = [];
		var agentsFcr = {};
		
		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.statAvg = [];
		vm.totalAvg = {};
		vm.columns = {};
		vm.qnum = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getStat = getStat;
		vm.getAvgStat = getAvgStat;
		vm.openSettings = openSettings;
		vm.tableSort = '';
		vm.tableAvgSort = 'agent';
		vm.data = store.get('data');

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				vm.columns = getColumns(dbSettings.tables);
				
				debug.log('qos init: ', dbSettings);
				
				return $q.resolve(vm.settings);
					
			})
			.then(function(settings) {
				return TasksService.getTasks(settings.kinds);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks);
				vm.tasks = Object.keys(tasks)
							.map(function(key) { return tasks[key]; })
							.reduce(function(prev, next) { return prev.concat(next); }, []);

				vm.selectedTasks = vm.tasks;
				
				return $q.resolve();
			})
			.then(getStat)
			.catch(errorService.show);
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'qos/qos-settings.html',
				controller: 'QosSettingsController',
				controllerAs: 'qosSettsVm',
				parent: angular.element(document.body),
				locals: {
					tasks: vm.tasks,
					selectedTasks: vm.selectedTasks
				}
			}).then(function(result) {
				vm.selectedTasks = result.selectedTasks;
				getStat();
			});
		}

		function getColumns(tables) {

			// var tables = vm.settings.tables;
			
			debug.log('qos getColumns: ', tables);

			return {
				procid: [tables.qoscheck.name, tables.qoscheck.columns.procid].join('.'),
				date: [tables.qoscheck.name, tables.qoscheck.columns.callstamp].join('.'),
				task: [tables.processed.name, 'taskid'].join('.'),
				agent: [tables.qoscheck.name, tables.qoscheck.columns.opername].join('.'),
				phone: [tables.qoscheck.name, tables.qoscheck.columns.phone].join('.'),
				category: [tables.categories.name, tables.categories.columns.description].join('.'),
				subcategory: [tables.subcategories.name, tables.subcategories.columns.description].join('.'),
				company: [tables.companies.name, tables.companies.columns.description].join('.'),
				question: [tables.qoscheck_answers.name, tables.qoscheck_answers.columns.quenum].join('.'),
				answer: [tables.qoscheck_answers.name, tables.qoscheck_answers.columns.answer].join('.'),
				comment: [tables.qoscheck.name, tables.qoscheck.columns.result].join('.')
			};
		}

		function getStat() {
			var tables = vm.settings.tables;
			var metrics = [];

			vm.tableSort = 'date';

			spinnerService.show('qos-loader');
			spinnerService.show('qos-avg-loader');

			return api.getCustomListStatistics({
				tables: [tables.calls.name, tables.categories.name, tables.subcategories.name, tables.companies.name, tables.qoscheck.name, tables.qoscheck_answers.name],
				tabrel: 
						'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.processed.name, 'procid'].join('.')+'='+[tables.qoscheck.name, tables.qoscheck.columns.procid].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.process_id].join('.')+'='+[tables.qoscheck.name, tables.qoscheck.columns.procid].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.')+
						' and '+[tables.qoscheck.name, tables.qoscheck.columns.procid].join('.')+'='+[tables.qoscheck_answers.name, tables.qoscheck_answers.columns.procid].join('.'),
				procid: [tables.qoscheck.name, tables.qoscheck.columns.procid].join('.'),
				columns: Object.keys(vm.columns).map(function(key) { return vm.columns[key]; }),
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(showStat)
			.catch(errorService.show);

		}

		function showStat(response) {
			var stat = [];
			var data = response.data.result;
			var columns = vm.columns;
			// var question = {};

			if(data.length) {
				// to object
				stat = data.reduce(function(prev, next) {
					if(!prev[next[columns.procid]]) {
						prev[next[columns.procid]] = next;

					}
					prev[next[columns.procid]].date = next[columns.date];
					prev[next[columns.procid]].task = next[columns.task];
					prev[next[columns.procid]].agent = next[columns.agent];
					prev[next[columns.procid]].phone = next[columns.phone];
					prev[next[columns.procid]].category = next[columns.category];
					prev[next[columns.procid]].subcategory = next[columns.subcategory];
					prev[next[columns.procid]].company = next[columns.company];
					prev[next[columns.procid]].comment = next[columns.comment];
					prev[next[columns.procid]].questions = prev[next[columns.procid]].questions || {};
					prev[next[columns.procid]].questions[next[columns.question]] = parseFloat(next[columns.answer]) || 0;

					// prev[next[columns.procid]].questions.push(question);

					return prev;
				}, {});

				// back to array
				stat = Object.keys(stat).map(function(key) {
					return stat[key];
				});
			}

			vm.stat = stat;
			vm.qnum = stat.length ? Object.keys(stat[0].questions) : [];

			getAvgStat();

			spinnerService.hide('qos-loader');
			spinnerService.hide('qos-avg-loader');

		}

		function getAvgStat() {
			var columns = vm.columns;
			var item = {};
			var totalAvg = {};
			var statAvg = vm.stat.reduce(function(prev, next) {
				prev[next[columns.agent]] = prev[next[columns.agent]] || {};
				item = prev[next[columns.agent]];
				item.agent = next[columns.agent];
				item.questions = item.questions || {};
				Object.keys(next.questions).forEach(function(key) {
					item.questions[key] = item.questions[key] ? (item.questions[key] + next.questions[key]) : next.questions[key];
					totalAvg[key] = totalAvg[key] ? (totalAvg[key] + next.questions[key]) : next.questions[key];
				});
				item.count = item.count ? (item.count+1) : 1;

				return prev;
			}, {});

			// back to array
			statAvg = Object.keys(statAvg).map(function(key) {
				return statAvg[key];
			});

			vm.statAvg = statAvg;
			vm.totalAvg = totalAvg;

		}

		function getTaskList(data) {
			var tasks = [];

			if(data) {
				Object.keys(data).forEach(function(item) {
					tasks = tasks.concat(data[item].tasks);
				});
			}
				
			return tasks;
		}

	}

})();