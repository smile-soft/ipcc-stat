(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('FcrSettingsController', FcrSettingsController);

	FcrSettingsController.$inject = ['$scope', '$mdDialog', 'tasks', 'cats', 'subcats', 'selectedCats', 'selectedSubcats', 'selectedTasks', 'debugService'];

	function FcrSettingsController($scope, $mdDialog, tasks, cats, subcats, selectedCats, selectedSubcats, selectedTasks, debug) {

		var vm = this;

		vm.tasks = [].concat(tasks);
		vm.selectedTasks = [].concat(selectedTasks);
		vm.cats = cats;
		vm.subcats = subcats;
		vm.selectedCats = [].concat(selectedCats);
		vm.selectedSubcats = [].concat(selectedSubcats);
		vm.selectAllTasks = selectAllTasks;
		vm.selectAllCats = selectAllCats;
		vm.allTasksSelected = (tasks.length === selectedTasks.length);
		vm.allCatsSelected = (cats.length === selectedCats.length);
		vm.save = save;
		vm.close = closeSettings;
		vm.toggle = toggle;
		vm.index = index;
		vm.exists = exists;
		vm.showSubcats = showSubcats;
		vm.selectCat = selectCat;
		vm.selectedCat = null;

		$scope.$watch(function(){
			return vm.selectedTasks.length;
		}, function(val){
			vm.allTasksSelected = vm.selectedTasks.length === vm.tasks.length;
		});

		debug.log('tasksm selectedTasks: ', vm.tasks, vm.selectedTasks);
		debug.log('tasksm selectedCats: ', vm.cats, vm.selectedCats);
		debug.log('tasksm selectedSubcats: ', vm.cats, vm.selectedSubcats);

		function save() {
			$mdDialog.hide({
				selectedTasks: vm.selectedTasks,
				selectedCats: vm.selectedCats,
				selectedSubcats: vm.selectedSubcats
			});
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

		function showSubcats(catid) {
			vm.selectedCat = catid;
			console.log('showSubcats: ', catid);
		}

		function selectCat(catid, checked) {
			debug.log('selectCat: ', checked, catid);
			toggle(catid, vm.selectedCats);
			if(!checked) selectAllSubcats(catid);
			else deselectAllSubcats(catid);
		}

		function selectAllTasks() {
			if(vm.allTasksSelected) vm.selectedTasks = [].concat(tasks);
			else vm.selectedTasks = [];
		}

		function selectAllCats() {
			if(vm.allCatsSelected) {
				vm.selectedCats = [].concat(cats).map(function(item) { return item.id });
				selectAllSubcats();
			} else {
				vm.selectedCats = [];
				deselectAllSubcats();
			}
		}

		function selectAllSubcats(catid) {
			var catSubcats = vm.subcats.filter(function(item) {
				return item.catid === catid;
			})
			.map(function(item) {
				return item.id;
			});

			if(catid !== undefined) {
				vm.selectedSubcats = vm.selectedSubcats.concat(catSubcats);
			} else {
				vm.selectedSubcats.length = 0; 
				vm.selectedSubcats = vm.selectedSubcats.concat(vm.subcats.map(function(item) { return item.id }));
			}
			
			debug.log('selectAllSubcats: ', catid, catSubcats, vm.selectedSubcats);

		}

		function deselectAllSubcats(catid) {
			var catSubcats = vm.subcats.filter(function(item) {
				return item.catid === catid;
			})
			.map(function(item) {
				return item.id;
			});

			if(catid !== undefined) {
				catSubcats.forEach(function(item) {
					if(vm.selectedSubcats.indexOf(item) !== -1)
						vm.selectedSubcats.splice(vm.selectedSubcats.indexOf(item), 1);
				});
			} else {
				vm.selectedSubcats.length = 0;
			}
			
		}

		function toggle(item, list) {
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