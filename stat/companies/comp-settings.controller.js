(function(){

	'use strict';

	angular
		.module('app.companies')
		.controller('CompSettingsController', CompSettingsController);

	CompSettingsController.$inject = ['$scope', '$mdDialog', 'tasks', 'selectedTasks', 'sl', 'debugService'];

	function CompSettingsController($scope, $mdDialog, tasks, selectedTasks, sl, debug) {

		var vm = this;

		vm.tasks = [].concat(tasks);
		vm.selectedTasks = [].concat(selectedTasks);
		vm.sl = sl;
		vm.sls = [5, 10, 15, 20, 25, 30, 35, 40];
		vm.selectAllTasks = selectAllTasks;
		vm.allTasksSelected = (tasks.length === selectedTasks.length);
		vm.save = save;
		vm.close = closeSettings;
		vm.toggle = toggle;
		vm.index = index;
		vm.exists = exists;

		$scope.$watch(function(){
			return vm.selectedTasks.length;
		}, function(val){
			vm.allTasksSelected = vm.selectedTasks.length === vm.tasks.length;
		});

		function save() {
			$mdDialog.hide({
				selectedTasks: vm.selectedTasks,
				sl: vm.sl
			});
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

		function selectAllTasks() {
			if(vm.allTasksSelected) vm.selectedTasks = [].concat(tasks);
			else vm.selectedTasks = [];
		}

		function toggle(item, list) {
			debug.log('toggle: ', item, list);
			var idx = index(item, list);
			if (idx !== -1) list.splice(idx, 1);
			else list.push(item);
		}

		function index(item, list) {
			var idx = -1;
			list.forEach(function(listItem, index){
				if(listItem == item) idx = index;
			});
			return idx;
		}

		function exists(item, list) {
			return list.indexOf(item) > -1;
		}

	}

})();