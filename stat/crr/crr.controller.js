(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('CrrController', CrrController);

	CrrController.$inject = ['$rootScope', '$mdDialog', '$q', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function CrrController($rootScope, $mdDialog, $q, SettingsService, api, store, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 month'
		};
		var perfStat = [];
		var agentStat = [];
		var agentsFcr = {};
		var agentsFormCompl = {};

		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getCallResolution = getCallResolution;
		vm.onAgentSelect = onAgentSelect;
		vm.openSettings = openSettings;
		vm.tableSort = '-perf';
		// vm.data = store.get('data');

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = angular.merge({}, dbSettings);
				return $q.resolve(vm.settings);
				// return getTaskList(vm.data);
				// return TasksService.getTaskList(1);
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
			.then(getCallResolution)
			.catch(errorService.show);

		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'crr/crr-settings.html',
				controller: 'CrrSettingsController',
				controllerAs: 'crrSettsVm',
				parent: angular.element(document.body),
				locals: {
					tasks: vm.tasks,
					selectedTasks: vm.selectedTasks
				}
			}).then(function(result) {
				vm.selectedTasks = result.selectedTasks;
				getCallResolution();
			});
		}

		function getCallResolution() {
			var tables = vm.settings.tables;

			spinnerService.show('crr-loader');

			return getAgentsStat(tables, vm.begin.valueOf(), vm.end.valueOf())
			.then(function(astat) {
				debug.log('getAgentsStat data: ', astat.data.result);
				agentStat = astat.data.result
				return getPerfStat(tables, vm.begin.valueOf(), vm.end.valueOf());
			})
			.then(function(pstat) {
				debug.log('getPerfStat data: ', pstat.data.result);
				debug.log('selectedTasks: ', vm.selectedTasks);
				perfStat = pstat.data.result;
				vm.stat = angular.merge([], agentStat, perfStat);
				vm.stat.map(addPerfValue);

				return api.getFCRStatistics({
					task: vm.selectedTasks,
					table: [tables.calls.name],
					procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
					interval: 3600*24*1000,
					begin: vm.begin.valueOf(), 
					end: vm.end.valueOf()
				});
			})
			.then(function(fcr) {
				spinnerService.hide('crr-loader');
				
				agentsFcr = arrayToObjectAndSum(fcr.data.result, 'agent');
				debug.log('fcr: ', agentsFcr);
				vm.stat.map(addFcrValue);

				return getFormCompletionStat(tables, vm.begin.valueOf(), vm.end.valueOf())

			})
			.then(function(result) {
				debug.log('getFormCompletionStat: ', result.data.result);
				agentsFormCompl = arrayToObjectAndSum(result.data.result, 'operator');
				vm.stat.map(addFormCompValue);

				debug.log('final stat: ', vm.stat);

			})
			.catch(errorService.show);
		}

		function getAgentsStat(tables, begin, end){
			var data,
			metrics = ['count(*)','sum(connectTime)','avg(connectTime)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.operator],
				begin: begin,
				end: end,
				metrics: metrics
			});
		}

		function getPerfStat(tables, begin, end){
			var data,
			metrics = ['count(callresult)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid'+
						' and '+[tables.calls.name, tables.calls.columns.callresult].join('.')+'=1',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult, tables.calls.columns.operator],
				begin: begin,
				end: end,
				metrics: metrics
			});
		}

		function getFormCompletionStat(tables, begin, end){
			var metrics = ['count(*)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+' != 0'+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+' != 0'+
						// ' and '+[tables.calls.name, tables.calls.columns.crmid].join('.')+' is not NULL'+
						// ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+' != 0'+
						' and '+[tables.calls.name, tables.calls.columns.customer_name].join('.')+' is not NULL'+
						' and '+[tables.calls.name, tables.calls.columns.process_id].join('.')+'=processed.procid',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.operator],
				begin: begin,
				end: end,
				metrics: metrics
			});
		}

		function onAgentSelect(item) {
			var tables = vm.settings.tables;
			var tablesList = [tables.processed.name, tables.calls.name];
			if(tables.categories) tablesList.push(tables.categories.name);
			if(tables.subcategories) tablesList.push(tables.subcategories.name);
			if(tables.companies) tablesList.push(tables.companies.name);

			var columnsAlias = {
				agent: [tables.calls.name, tables.calls.columns.operator].join('.'),
				phone: [tables.calls.name, tables.calls.columns.customer_phone].join('.'),
				date: [tables.calls.name, tables.calls.columns.calldate].join('.'),
				comment: [tables.calls.name, tables.calls.columns.comments].join('.')
			},
			columns, columnsKeys;

			if(tables.calls.columns.company) columnsAlias.description = [tables.companies.name, tables.companies.columns.description].join('.');
			if(tables.calls.columns.customer_name) columnsAlias.cname = [tables.calls.name, tables.calls.columns.customer_name].join('.');
			if(tables.calls.columns.callresult) columnsAlias.callresult = [tables.calls.name, tables.calls.columns.callresult].join('.');
			if(tables.calls.columns.login) columnsAlias.login = [tables.calls.name, tables.calls.columns.login].join('.');
			if(tables.calls.columns.category) columnsAlias.category = [tables.categories.name, tables.categories.columns.description].join('.');
			if(tables.calls.columns.subcategory) columnsAlias.subcategory = [tables.subcategories.name, tables.subcategories.columns.description].join('.');
			if(tables.calls.columns.crmid) columnsAlias.crmid = [tables.calls.name, tables.calls.columns.crmid].join('.');

			columns = Object.keys(columnsAlias).map(function(key) { return columnsAlias[key]; });
			columnsKeys = Object.keys(columnsAlias).map(function(key) { return key; });

			return api.getQueryResultSet({
				tables: tablesList,
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'="'+item[tables.calls.columns.operator]+'"'+
						' and '+[tables.calls.name, tables.calls.columns.process_id].join('.')+'=processed.procid',
				columns: Object.keys(columns).map(function(key) { return columns[key]; }),
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			}).then(function(response){
				spinnerService.hide('crr-loader');
				
				var processes = utils.queryToObject(response.data.result, columnsKeys);

				$mdDialog.show({
					templateUrl: 'dashboard/export-processes.html',
					locals: {
						tables: vm.settings.tables,
						begin: vm.begin,
						end: vm.end,
						data: processes
					},
					controller: 'ProcessesExportController',
					controllerAs: 'procExpVm',
					parent: angular.element(document.body),
					fullscreen: vm.userFullScreen
				});

				debug.log('onAgentSelect result: ', response);
			});
		}

		function addPerfValue(item) {
			item.perf = item['count(callresult)'] / item['count(*)'] * 100;
			return item;
		}

		function addFcrValue(item) {
			var currFcr = agentsFcr[item.operator];
			item.fcr = currFcr !== undefined ? (currFcr.fcr / currFcr.total * 100) : null;
			return item;
		}

		function addFormCompValue(item) {
			var val = agentsFormCompl[item.operator];
			if(!val) return item;

			var completed = val['count(*)'];
			var total = item['count(*)'];
			item.completion = val !== undefined ? (completed / total * 100) : null;
			return item;
		}

		function getTaskList(data) {
			var tasks = [];
			Object.keys(data).forEach(function(item) {
				tasks = tasks.concat(data[item].tasks);
			});
			return tasks;
		}

		function arrayToObject(array, propName) {
			return array.reduce(function(prev, next) {
				if(next.hasOwnProperty(propName)) {
					prev[next[propName]] = next;
					return prev;
				}
			}, {});
		}

		function arrayToObjectAndSum(array, propName) {
			return array.reduce(function(prev, next) {
				if(next.hasOwnProperty(propName)) {
					prev[next[propName]] = prev[next[propName]] ? sumObjects(next, prev[next[propName]]) : next;
					
					return prev;
				}
			}, {});
		}

		function sumObjects() {
			var args = [].slice.call(arguments);
			var sum = {};

			return args.reduce(function(total, next) {

				Object.keys(next)
				.forEach(function(key) {
					if(typeof next[key] === 'number') {
						total[key] = total[key] ? total[key] + next[key] : next[key];
					} else {
						total[key] = next[key];
					}
				});

				return total;

			}, sum);
		}

	}

})();