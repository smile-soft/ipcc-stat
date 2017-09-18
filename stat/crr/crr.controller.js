(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('CrrController', CrrController);

	CrrController.$inject = ['$rootScope', '$mdDialog', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function CrrController($rootScope, $mdDialog, SettingsService, api, store, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 month'
		};
		var perfStat = [];
		var agentStat = [];
		var agentsFcr = {};

		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getCallResolution = getCallResolution;
		vm.openSettings = openSettings;
		vm.tableSort = '-perf';
		vm.data = store.get('data');

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return getTaskList(vm.data);
				// return TasksService.getTaskList(1);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks);
				vm.tasks = tasks;
				vm.selectedTasks = tasks;
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
				agentsFcr = arrayToObjectAndSum(fcr.data.result, 'agent');
				debug.log('fcr: ', agentsFcr);
				vm.stat.map(addFcrValue);
				spinnerService.hide('crr-loader');
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

		function addPerfValue(item) {
			item.perf = item['count(callresult)'] / item['count(*)'] * 100;
			return item;
		}

		function addFcrValue(item) {
			var currFcr = agentsFcr[item.operator];
			item.fcr = currFcr !== undefined ? (currFcr.fcr / currFcr.total * 100) : null;
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