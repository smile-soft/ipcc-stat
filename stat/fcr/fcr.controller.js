(function(){

	'use strict';

	angular
		.module('app.fcr')
		.controller('FcrController', FcrController);

	FcrController.$inject = ['$rootScope', '$q', '$mdDialog', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'chartService', 'errorService'];

	function FcrController($rootScope, $q, $mdDialog, SettingsService, api, store, TasksService, utils, debug, spinnerService, chartService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 month',
			interval: 3600*24*1000
		};
		var catFcr = {};
		var subcatFcr = {};
		var agentsFcr = {};
		var withSubcats = true;

		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.selectedCat = null;
		vm.selectedSubcat = null;
		vm.cats = [];
		vm.subcats = [];
		vm.selectedCats = [];
		vm.selectedSubcats = [];
		vm.agentsFcr = [];
		vm.totalAgentsFcr = [];
		vm.catFcr = [];
		vm.totalCatFcr = [];
		vm.subcatFcr = [];
		vm.totalSubcatFcr = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getCatFcr = getCatFcr;
		vm.openSettings = openSettings;
		vm.tableSort = 'fcrRate';
		vm.getFcr = getFcr;
		vm.getAgentFcr = getAgentFcr;
		vm.onCatSelect = onCatSelect;
		vm.onSubcatSelect = onSubcatSelect;
		vm.countFcr = countFcr;
		vm.data = store.get('data');

		init();
		spinnerService.show('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				if(!vm.settings.tables.subcategories.columns.category_id) 
					withSubcats = false;

				// return TasksService.getTaskList(1);
				return getTaskList(vm.data);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks);
				vm.tasks = tasks;
				vm.selectedTasks = store.get('selectedTasks') || tasks;
				vm.selectedCats = store.get('selectedCats') || [];
				vm.selectedSubcats = store.get('selectedSubcats') || [];

				spinnerService.hide('main-loader');

				return $q(function(resolve, reject) {
					resolve();
				});
			})
			.then(getCategories)
			.then(function() {
				if(withSubcats) {
					return getSubcategories();
				} else {
					return $q(function(resolve, reject) {
						resolve();
					});
				}
			})
			.then(getFcr)
			.catch(errorService.show);
		}

		function getFcr() {
			return getAgentFcr()
			.then(getCatFcr)
			.then(getSubcatFcr)
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'fcr/fcr-settings.html',
				controller: 'FcrSettingsController',
				controllerAs: 'fcrSettsVm',
				parent: angular.element(document.body),
				locals: {
					tasks: vm.tasks,
					cats: vm.cats,
					subcats: vm.subcats,
					selectedCats: vm.selectedCats,
					selectedSubcats: vm.selectedSubcats,
					selectedTasks: vm.selectedTasks
				}
			}).then(function(result) {
				vm.selectedTasks = result.selectedTasks;
				vm.selectedCats = result.selectedCats;
				vm.selectedSubcats = result.selectedSubcats;

				store.set('selectedTasks', vm.selectedTasks);
				store.set('selectedCats', vm.selectedCats);
				store.set('selectedSubcats', vm.selectedSubcats);

				debug.log('openSettings closed: ', vm.selectedCats, vm.selectedSubcats);

				getFcr();
			});
		}

		// function setCharts() {
		// 	vm.catChartData = chartService.setChartData(vm.agentsFcr, 'fcrRate', 'agent');
		// 	vm.aChartData = chartService.setChartData(vm.catFcr, 'fcrRate', 'catdesc');
		// 	debug.log('vm.catChartData: ', vm.catChartData);
		// 	debug.log('vm.aChartData: ', vm.aChartData);
		// }

		function getCategories(){
			var tables = vm.settings.tables;
			var columns = [
				[tables.categories.name, tables.categories.columns.description].join('.'),
				[tables.categories.name, tables.categories.columns.id].join('.')
			];
			
			return api.getQueryResultSet({
				tables: [tables.categories.name],
				columns: columns,
				groupBy: [tables.categories.columns.description, tables.categories.columns.id].join(',')
			}).then(function(cats){
				vm.cats = cats.data.result.length ? (cats.data.result.map(function(cat) { return { desc: cat[0], id: cat[1] } })) : [];
				vm.selectedCats = vm.selectedCats.length ? vm.selectedCats : [].concat(vm.cats).map(function(item) { return item.id });
				debug.log('getCategories: ', vm.cats, vm.selectedCats);

			})
			.catch(errorService.show);
		}

		function getSubcategories(){
			var tables = vm.settings.tables;
			var columns = [
				[tables.categories.name, tables.categories.columns.description].join('.'),
				[tables.categories.name, tables.categories.columns.id].join('.'),
				[tables.subcategories.name, tables.subcategories.columns.description].join('.'),
				[tables.subcategories.name, tables.subcategories.columns.id].join('.')
			];
			
			return api.getQueryResultSet({
				tables: [tables.categories.name, tables.subcategories.name],
				columns: columns,
				tabrel: tables.subcategories.name+'.'+tables.subcategories.columns.category_id+'='+tables.categories.name+'.'+tables.categories.columns.id,
				groupBy: [tables.categories.columns.description, tables.categories.name+'.'+tables.categories.columns.id, tables.subcategories.columns.description, tables.subcategories.columns.id].join(',')
				// groupBy: [tables.categories.columns.description, tables.subcategories.columns.description]
			}).then(function(subcats){
				debug.log('getSubcategories: ', subcats);
				vm.subcats = subcats.data.result.length ? (subcats.data.result.map(function(subcat) { return { catid: subcat[1], desc: subcat[2], id: subcat[3] } })) : [];
				vm.selectedSubcats = vm.selectedSubcats.length ? vm.selectedSubcats : [].concat(vm.subcats).map(function(item) { return item.id });

			})
			.catch(errorService.show);
		}

		function getAgentFcr() {
			var tables = vm.settings.tables;
			var opts = {
				task: vm.selectedTasks,
				table: [tables.calls.name],
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				interval: 3600*24*1000,
				begin: vm.begin.valueOf(), 
				end: vm.end.valueOf()
			}

			if(!vm.selectedCats.length) {
				return $q(function(resolve, reject) {
					resolve();
				});
			}

			spinnerService.show('agents-fcr-loader');
			
			opts.table.push(tables.categories.name, tables.subcategories.name);
			opts.where = [tables.calls.name, tables.calls.columns.category].join('.')+'='+ [tables.categories.name, tables.categories.columns.id].join('.');
			opts.where += ' and ' + [tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+ [tables.subcategories.name, tables.subcategories.columns.id].join('.');
			if(withSubcats)
				opts.where += ' and ' + [tables.subcategories.name, tables.subcategories.columns.id].join('.')+' in '+arrayToIn(vm.selectedSubcats);

			// if category selected 
			if(vm.selectedCat !== null) {
				opts.where += ' and ' + [tables.categories.name, tables.categories.columns.description].join('.')+'=\''+vm.selectedCat+'\'';

				// if subcategory selected 
				if(vm.selectedSubcat !== null) {
					opts.where += ' and ' + [tables.subcategories.name, tables.subcategories.columns.description].join('.')+'=\''+vm.selectedSubcat+'\'';
				}

			} 
			else if(vm.selectedCats.length) {
				// get agents FCR only with selected categories
				opts.where += ' and ' + [tables.categories.name, tables.categories.columns.id].join('.')+' in '+arrayToIn(vm.selectedCats);
			}

			return api.getFCRStatistics(opts)
			.then(function(result) {
				agentsFcr = arrayToObjectAndSum(result.data.result, 'agent');
				vm.agentsFcr = Object.keys(agentsFcr).map(function(key) {
					return agentsFcr[key];
				})
				.map(countFcr);

				vm.totalAgentsFcr = vm.agentsFcr.length ? vm.agentsFcr.reduce(sumObjects) : [];

				spinnerService.hide('agents-fcr-loader');
				debug.log('getAgentFcr: ', vm.agentsFcr);
			})
			.catch(errorService.show);
		}

		function getCatFcr() {
			
			if(!vm.selectedCats.length) {
				return $q(function(resolve, reject) {
					resolve();
				});
			}

			var tables = vm.settings.tables,
				params = {
					task: vm.selectedTasks,
					table: [tables.calls.name, tables.categories.name, tables.subcategories.name],
					where: [tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.') +
							' and ' + [tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') +
							' and ' + [tables.categories.name, tables.categories.columns.id].join('.')+' in '+arrayToIn(vm.selectedCats) +
							(withSubcats ? ' and ' + [tables.subcategories.name, tables.subcategories.columns.id].join('.')+' in '+arrayToIn(vm.selectedSubcats) : ''),
					procid: tables.calls.columns.process_id,
					column: [tables.categories.columns.description, tables.subcategories.columns.description],
					interval: defaultOptions.interval,
					begin: vm.begin.valueOf(),
					end: vm.end.valueOf()
				};

			spinnerService.show('cat-fcr-loader');

			return api.getCustomFCRStatistics(params)
			.then(function(result) {
				catFcr = arrayToObjectAndSum(result.data.result, tables.categories.columns.description);
				vm.catFcr = Object.keys(catFcr)
				.map(function(key) {
					return catFcr[key];
				})
				.map(countFcr);

				vm.totalCatFcr = vm.catFcr.length ? vm.catFcr.reduce(sumObjects) : [];

				spinnerService.hide('cat-fcr-loader');
				debug.log('getCatFcr: ', vm.catFcr, vm.totalCatFcr);
			})
			.catch(errorService.show);
		}

		function getSubcatFcr() {
			// spinnerService.show('fcr-loader');
			var tables = vm.settings.tables;

			if(vm.selectedCat === null) {
				return $q(function(resolve, reject) {
					resolve();
				});
			}

			spinnerService.show('cat-fcr-loader');

			return api.getCustomFCRStatistics({
				task: vm.selectedTasks,
				table: [tables.calls.name, tables.categories.name, tables.subcategories.name],
				where: [tables.categories.name, tables.categories.columns.description].join('.') + '=\'' + vm.selectedCat + '\' and ' +
						[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.') + ' and ' +
						[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') +
						' and ' + [tables.subcategories.name, tables.subcategories.columns.id].join('.')+' in '+arrayToIn(vm.selectedSubcats),
				procid: tables.calls.columns.process_id,
				column: [tables.subcategories.columns.description],
				interval: defaultOptions.interval,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			})
			.then(function(result) {
				subcatFcr = arrayToObjectAndSum(result.data.result, 'probdesc');
				vm.subcatFcr = Object.keys(subcatFcr)
				.map(function(key) {
					return subcatFcr[key];
				})
				.map(countFcr);

				vm.totalSubcatFcr = vm.subcatFcr.reduce(sumObjects);

				spinnerService.hide('cat-fcr-loader');
				debug.log('getSubcatFcr: ', vm.subcatFcr, vm.totalSubcatFcr);
			})
			.catch(errorService.show);
		}

		function onCatSelect(cat) {
			debug.log('onCatSelect: ', cat);
			vm.selectedCat = cat;
			
			getAgentFcr()
			.then(getSubcatFcr);
		}

		function onSubcatSelect(subcat) {
			debug.log('onSubcatSelect: ', subcat);
			vm.selectedSubcat = subcat;
			getAgentFcr();
		}

		function countFcr(obj) {
			obj.fcrRate = obj.fcr / obj.total * 100;
			return obj
		}

		function getTaskList(data) {
			var tasks = [];
			Object.keys(data).forEach(function(item) {
				tasks = tasks.concat(data[item].tasks);
			});
			return tasks;
		}

		function arrayToObjectAndSum(array, propName) {
			if(!array.length) return array;

			return array.reduce(function(prev, next) {
				if(next.hasOwnProperty(propName)) {
					prev[next[propName]] = prev[next[propName]] ? sumObjects(next, prev[next[propName]]) : next;
					
					return prev;
				}
			}, {});
		}

		function arrayToIn(array) {
			return "('" + array.join("','") + "')";
		}

		function sumObjects() {
			var args = [].slice.call(arguments);
			var sum = {};

			return args.reduce(function(total, next) {

				Object.keys(next)
				.forEach(function(key) {
					if(typeof next[key] === 'number') {
						total[key] = total[key] ? total[key] + next[key] : next[key];
					} else {
						total[key] = next[key];
					}
				});

				return total;

			}, sum);
		}

	}

})();