(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.directive('statCard', statCard);

	function statCard(){

		return {
			restrict: 'AE',
			replace: true,
			scope: {
				model: '@',
				title: '@',
				subhead: '@',
				prevstat: '@',
				dynamics: '@',
				cardClass: '@',
				flexValue: '@'
			},
			templateUrl: 'assets/partials/card.html'
		};

	}

})();