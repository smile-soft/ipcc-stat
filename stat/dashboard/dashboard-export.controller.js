(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashExportController', DashExportController);

	DashExportController.$inject = ['$mdDialog', 'kinds', 'tables', 'data', 'begin', 'end', 'stat', 'prevstat', 'catstat'];

	function DashExportController($mdDialog, kinds, tables, data, begin, end, stat, prevstat, catstat) {

		var vm = this;

		vm.kinds = kinds;
		vm.tables = tables;
		vm.data = data;
		vm.begin = begin;
		vm.end = end;
		vm.stat = stat;
		vm.prevstat = prevstat;
		vm.catstat = catstat;
		vm.close = function(){
			$mdDialog.hide();
		};

	}

})();