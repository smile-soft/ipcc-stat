(function(){

	'use strict';

	angular
		.module('app')
		.controller('SpinnerController', SpinnerController);

	SpinnerController.$inject = ['spinnerService', '$scope'];

	function SpinnerController(spinnerService, $scope) {

		var vm = this;

		// register should be true by default if not specified.
		if (!vm.hasOwnProperty('register')) {
			vm.register = true;
		} else {
			vm.register = vm.register.toLowerCase() === 'false' ? false : true;
		}

		// Declare a mini-API to hand off to our service so the service
		// doesn't have a direct reference to this directive's scope.
		var api = {
			name: vm.name,
			group: vm.group,
			show: function () {
				vm.show = true;
			},
			hide: function () {
				vm.show = false;
			},
			toggle: function () {
				vm.show = !vm.show;
			}
		};

		// Register this spinner with the spinner service.
		if (vm.register === true) {
			console.log('spinner: ', api);
			spinnerService._register(api);
		}

		// If an onShow or onHide expression was provided, register a watcher
		// that will fire the relevant expression when show's value changes.
		if (vm.onShow || vm.onHide) {
			$scope.$watch('show', function (show) {
				if (show && vm.onShow) {
					vm.onShow({ spinnerService: spinnerService, spinnerApi: api });
				} else if (!show && vm.onHide) {
					vm.onHide({ spinnerService: spinnerService, spinnerApi: api });
				}
			});
		}

		// This spinner is good to go. Fire the onLoaded expression.
		if (vm.onLoaded) {
			vm.onLoaded({ spinnerService: spinnerService, spinnerApi: api });
		}

	}

})();