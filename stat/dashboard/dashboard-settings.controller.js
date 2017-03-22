(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashSettingsController', DashSettingsController);

	DashSettingsController.$inject = ['$mdDialog', 'options'];

	function DashSettingsController($mdDialog, options) {

		var vm = this;

		vm.options = angular.copy(options, {});
		vm.periods = ['1 hour', '1 day', '1 week', '1 month', '1 year'];
		vm.intervals = ['1 minutes', '5 minutes', '10 minutes', '20 minutes', '30 minutes', '1 hour'];
		vm.save = save;
		vm.close = closeSettings;
		vm.toggle = toggle;
		vm.index = index;

		function save() {
			$mdDialog.hide({
				options: vm.options
			});
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

		function toggle(item, list) {
			var idx = vm.index(item, list);
			if (idx > -1) list.splice(idx, 1);
			else list.push(item);
		}

		function index(item, list) {
			var idx = -1;
			list.forEach(function(listItem, index){
				if(listItem.kind == item.kind) idx = index;
			});
			return idx;
		}

	}

})();