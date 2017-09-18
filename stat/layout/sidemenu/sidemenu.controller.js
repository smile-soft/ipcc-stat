(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('SidemenuController', SidemenuController);

	SidemenuController.$inject = ['$rootScope', '$mdSidenav', 'SettingsService', 'errorService'];

	function SidemenuController($rootScope, $mdSidenav, SettingsService, errorService) {

		var vm = this;
		vm.isOpen = false;
		vm.settings = {};
		vm.tables = {};

		$rootScope.$on('$routeChangeSuccess', function() {
			if(vm.isOpen) 
				$mdSidenav('sidenav').toggle();
		});

		SettingsService.getSettings()
		.then(function(dbSettings){
			vm.settings = dbSettings;
			vm.tables = vm.settings.tables;
		})
		.catch(errorService.show);

	}

})();