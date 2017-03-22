(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('CrrController', CrrController);

	CrrController.$inject = ['$rootScope', '$mdDialog', 'SettingsService', 'apiService', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function CrrController($rootScope, $mdDialog, SettingsService, api, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 year'
		};
		var perfStat = [];
		var agentStat = [];

		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getCallResolution = getCallResolution;
		vm.openSettings = openSettings;
		vm.tableSort = '-perf';

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return TasksService.getTaskList(1);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks.data.result);
				vm.tasks = tasks.data.result;
				vm.selectedTasks = tasks.data.result;
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
			spinnerService.show('crr-loader');

			return getAgentsStat(vm.settings.tables, vm.begin.valueOf(), vm.end.valueOf())
			.then(function(astat) {
				debug.log('getAgentsStat data: ', astat.data.result);
				agentStat = astat.data.result
				return getPerfStat(vm.settings.tables, vm.begin.valueOf(), vm.end.valueOf());
			})
			.then(function(pstat) {
				debug.log('getPerfStat data: ', pstat.data.result);
				perfStat = pstat.data.result;
				vm.stat = angular.merge([], agentStat, perfStat);
				vm.stat.map(addPerfValue);
				
				debug.log('vm.stat: ', vm.stat);
				spinnerService.hide('crr-loader');
			})
			.catch(errorService.show);
		}

		function getAgentsStat(tables, begin, end){
			var data,
			metrics = ['count(*)','sum(connectTime)','avg(connectTime)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.tasks.join('\',\'')+'\')'+
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
				tabrel: 'taskid in (\''+vm.tasks.join('\',\'')+'\')'+
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

	}

})();