(function(){

	'use strict';

	angular
		.module('app.companies')
		.controller('CompaniesController', CompaniesController);

	CompaniesController.$inject = ['$scope', '$mdDialog', '$mdMedia', 'apiService', 'spinnerService', 'SettingsService', 'chartService', 'utilsService', 'debugService', 'errorService'];

	function CompaniesController($scope, $mdDialog, $mdMedia, api, spinnerService, SettingsService, chartService, utils, debug, errorService) {

		var vm = this;
		var defaults = {
			period: '1 month'
		};

		vm.sl = 20;
		vm.settings = {};
		vm.stat = [];
		vm.chartData = {};
		vm.chartOptions = {
			// responsive: false,
			// scales: {
			// 	yAxes: [{
			// 		display: false
			// 	}],
			// 	xAxes: [{
			// 		display: false
			// 	}]
			// },
			// legend: {
			// 	display: false
			// }
		};
		vm.chartLabel = 'nco';
		vm.chartMetrics = [{ index: 'nco', name: 'Number of calls offered' }, { index: 'nca', name: 'Number of calls answered' }, { index: 'aht', name: 'Average handle time' }, { index: 'att', name: 'Average talk time' }];
		vm.begin = utils.periodToRange(defaults.period).begin;
		vm.end = utils.periodToRange(defaults.period).end;
		vm.tableSort = '-nco';
		vm.getCompaniesStat = getCompaniesStat;
		vm.openSettings = openSettings;
		vm.onCompSelect = onCompSelect;
		vm.userFullScreen = $mdMedia('xs');
		

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return getCompaniesStat();
			})
			.then(function() {
				$scope.$watch(function() {
					return vm.chartLabel;
				}, function(newValue, prevValue) {
					vm.chartData = chartService.setChartData(vm.stat, vm.chartLabel, vm.settings.tables.companies.columns.description, vm.chartLabel);
				});
			})
			.catch(errorService.show);
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'companies/comp-settings.html',
				controller: 'CompSettingsController',
				controllerAs: 'compSettsVm',
				parent: angular.element(document.body),
				locals: {
					sl: vm.sl
				}
			}).then(function(result) {
				vm.sl = result.sl;
				getCompaniesStat();
			});
		}

		function getCompaniesStat(){
			var tables = vm.settings.tables;
			var tablesList = [tables.calls.name, tables.companies.name];
			var metrics = ['aht', 'att', 'nco', 'nca', 'car', 'asa', 'sl'+vm.sl];

			spinnerService.show('companies-loader');

			return api.getCustomListStatistics({
				tables: tablesList,
				tabrel: [tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.'),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.company, tables.companies.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(function(response) {
				
				debug.log('getCompaniesStat: ', response, response.data);

				spinnerService.hide('companies-loader')

				if(response.data.error) return errorService.show(response.data.error.message);
				vm.stat = response.data.result.length ? addPercentageValues(response.data.result, response.data.result.reduce(utils.getTotals)) : [];
				vm.chartData = chartService.setChartData(vm.stat, vm.chartLabel, tables.companies.columns.description, vm.chartLabel);
				
			})
			.catch(errorService.show);

		}

		function onCompSelect(item) {
			debug.log('onCompSelect: ', item);

			spinnerService.show('companies-loader');
			
			var tables = vm.settings.tables;
			var columnsAlias = {
				agent: [tables.calls.name, tables.calls.columns.operator].join('.'),
				phone: [tables.calls.name, tables.calls.columns.customer_phone].join('.'),
				date: [tables.calls.name, tables.calls.columns.calldate].join('.'),
				comment: [tables.calls.name, tables.calls.columns.comments].join('.')
			},
			columns, columnsKeys;

			var tablesList = [tables.processed.name, tables.calls.name];
			if(tables.companies) tablesList.push(tables.companies.name);

			if(tables.calls.columns.company) columnsAlias.description = [tables.companies.name, tables.companies.columns.description].join('.');
			if(tables.calls.columns.customer_name) columnsAlias.cname = [tables.calls.name, tables.calls.columns.customer_name].join('.');
			if(tables.calls.columns.callresult) columnsAlias.callresult = [tables.calls.name, tables.calls.columns.callresult].join('.');

			columns = Object.keys(columnsAlias).map(function(key) { return columnsAlias[key]; });
			columnsKeys = Object.keys(columnsAlias).map(function(key) { return key; });

			return api.getQueryResultSet({
				tables: tablesList,
				tabrel: [tables.calls.name, tables.calls.columns.company].join('.')+'='+item[tables.calls.columns.company]+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+				
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.process_id].join('.')+'=processed.procid',
				columns: Object.keys(columns).map(function(key) { return columns[key]; }),
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			}).then(function(response){
				spinnerService.hide('companies-loader');
				
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

				debug.log('onCompSelect result: ', response);
			});
		}

		function addPercentageValues(data, totals){
			var dataValue;
				// totals = data.reduce(utils.getTotals);

			return utils.setPercentageValues(data, totals).map(function(item){
				angular.forEach(item, function(value, key){
					dataValue = parseFloat(value);

					if(!isNaN(dataValue)) item[key] = dataValue;
				});
				return item;
			});
		}

	}

})();