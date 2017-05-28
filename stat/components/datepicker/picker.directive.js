(function(){

	'use strict';

	angular
		.module('app')
		.directive('picker', picker);

	function picker(){

		return {
			restrict: 'AE',
			replace: true,
			transclude: true,
			scope: {
				begin: "@?",
				end: "@?",
				minDate: "@?",
				maxDate: "@?",
				label: "@?",
				onSubmit: "&?",
				onChange: function() {
					
				}
			},
			template: [
				'<md-datepicker ng-change={{onChange}} ng-model="{{begin}}" md-max-date="{{maxDate}}"></md-datepicker>',
				'<md-datepicker ng-change={{onChange}} ng-model="{{end}}" md-min-date="{{minDate}}"></md-datepicker>',
				'<md-button class="md-primary" ng-click="{{onSubmit}}" aria-label="{{label}}">{{label}}</md-button>',
			].join(''),
			controller: [ '$scope', 'store', function($scope, store) {
				

				
			}]
		};

	}

})();