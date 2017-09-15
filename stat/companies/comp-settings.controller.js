(function(){

	'use strict';

	angular
		.module('app.companies')
		.controller('CompSettingsController', CompSettingsController);

	CompSettingsController.$inject = ['$scope', '$mdDialog', 'sl', 'debugService'];

	function CompSettingsController($scope, $mdDialog, sl, debug) {

		var vm = this;

		vm.sl = sl;
		vm.sls = [5, 10, 15, 20, 25, 30, 35, 40];
		vm.save = save;
		vm.close = closeSettings;

		function save() {
			$mdDialog.hide({
				sl: vm.sl
			});
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

	}

})();