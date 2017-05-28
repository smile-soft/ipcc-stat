(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('ProcessesExportController', ProcessesExportController);

	ProcessesExportController.$inject = ['$scope', '$filter', '$mdDialog', 'tables', 'begin', 'end', 'data', 'utilsService', 'debugService'];

	function ProcessesExportController($scope, $filter, $mdDialog, tables, begin, end, data, utils, debug) {

		var vm = this;

		vm.tables = tables;
		vm.begin = begin;
		vm.end = end;
		vm.data = data;

		debug.log('ProcessesExportController: ', vm.data);

		vm.order = tables.calls.columns.calldate,
		vm.search = '';
		vm.filter = {
			callresult: ''
		};

		vm.exportName = 'processes';
		// vm.exportName = $filter('date')(vm.begin, 'dd.MM.yy') + '-' + $filter('date')(vm.end, 'dd.MM.yy');

		vm.filterByResult = function(actual, expected) {
			return vm.filter.callresult ? (actual.callresult.toString() === vm.filter.callresult) : true;

		};

		vm.close = function(){
			$mdDialog.hide();
		};

	}

})();