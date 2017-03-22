(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('KindSettingsController', KindSettingsController);

	KindSettingsController.$inject = ['$scope', '$mdDialog', 'kind', 'list', 'tasks', 'kindMetrics', 'metrics', 'sl', 'defaultSL'];

	function KindSettingsController($scope, $mdDialog, kind, list, tasks, kindMetrics, metrics, sl, defaultSL) {

		var vm = this;

		vm.kind = kind;
		vm.list = [].concat(list);
		vm.tasks = [].concat(tasks).sort();
		vm.kindMetrics = [].concat(kindMetrics);
		vm.metrics = [].concat(metrics);
		vm.sl = sl;
		vm.defaultSL = defaultSL;
		vm.allTasksSelected = vm.list.length === vm.tasks.length;
		vm.save = save;
		vm.close = closeSettings;
		vm.toggle = toggle;
		vm.exists = exists;
		vm.selectAllTasks = selectAllTasks;

		$scope.$watch(function(){
			return vm.list.length;
		}, function(val){
			vm.allTasksSelected = vm.list.length === vm.tasks.length;
		});

		function save() {
			console.log('kind setts:', vm.list);
			$mdDialog.hide({
				sl: vm.sl,
				metrics: vm.kindMetrics,
				list: vm.list
			});
		}

		function selectAllTasks() {
			if(vm.allTasksSelected) vm.list = [].concat(tasks);
			else vm.list = [];
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

		function toggle(item, list) {
			var idx = list.indexOf(item);
			if (idx > -1) list.splice(idx, 1);
			else list.push(item);
		}

		function exists(item, list) {
			return list.indexOf(item) > -1;
		}

	}

})();