angular.module('app', [
	'app.core',
	'app.config',
	'app.routes',
	'app.layout',
	'app.crr',
	'app.fcr',
	'app.dashboard'
]);
angular.module('app.config', [
	'app.core'
])
.constant('appConfig', {
	server: window.location.protocol + '//' + window.location.host
})
.config(['$compileProvider', function ($compileProvider) {
  $compileProvider.debugInfoEnabled(false);
}])
.config(['ChartJsProvider',function(ChartJsProvider) {
	ChartJsProvider.setOptions({
		legendTemplate : "<ul class=\"custom-legend <%=name.toLowerCase()%>-legend\"><% for (var i=0; i<segments.length; i++){%><li><span style=\"background-color:<%=segments[i].fillColor%>\"></span><%if(segments[i].label){%><%=segments[i].label%><%}%></li><%}%></ul>"
	});
}]);

// .config(['$mdThemingProvider',function($mdThemingProvider) {
// 	$mdThemingProvider.theme('cyan');
// }])
// .config(['$translateProvider', function($translateProvider) {
// 	$translateProvider.useStaticFilesLoader({
// 		prefix: '/translations/locale-',
// 		suffix: '.json'
// 	});
// 	$translateProvider.preferredLanguage('en');
// 	$translateProvider.fallbackLanguage('en');
// 	$translateProvider.useStorage('storage');
// 	$translateProvider.useSanitizeValueStrategy('sanitizeParameters');
// 	// $translateProvider.useSanitizeValueStrategy('escape');
// }])
// .config(['tmhDynamicLocaleProvider', function(tmhDynamicLocaleProvider) {
// 	tmhDynamicLocaleProvider.localeLocationPattern('./js/lib/i18n/angular-locale_{{locale}}.js');
// }]);
angular.module('app.core', [
	'ngAnimate',
	'ngMaterial',
	'angularMoment',
	'angular-storage',
	'md.data.table',
	'chart.js'
]);
angular.module('app.crr', [
	'app.core'
]);
angular.module('app.dashboard', [
	'app.core'
]);
angular.module('app.fcr', [
	'app.core'
]);
angular.module('app.layout', [
	'app.core'
]);
angular.module('app.routes', [
	'ngRoute'
])
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		otherwise({
			redirectTo: '/dashboard'
		});
}]);
(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('CrrSettingsController', CrrSettingsController);

	CrrSettingsController.$inject = ['$scope', '$mdDialog', 'tasks', 'selectedTasks', 'debugService'];

	function CrrSettingsController($scope, $mdDialog, tasks, selectedTasks, debug) {

		var vm = this;

		vm.tasks = [].concat(tasks);
		vm.selectedTasks = [].concat(selectedTasks);
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

		debug.log('tasksm selectedTasks: ', vm.tasks, vm.selectedTasks);

		function save() {
			$mdDialog.hide({
				selectedTasks: vm.selectedTasks
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
(function(){

	'use strict';

	angular
		.module('app.crr')
		.controller('CrrController', CrrController);

	CrrController.$inject = ['$rootScope', '$mdDialog', 'SettingsService', 'apiService', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function CrrController($rootScope, $mdDialog, SettingsService, api, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 month'
		};
		var perfStat = [];
		var agentStat = [];
		var agentsFcr = {};

		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getCallResolution = getCallResolution;
		vm.openSettings = openSettings;
		vm.tableSort = '-perf';

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return TasksService.getTaskList(1);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks.data.result);
				vm.tasks = tasks.data.result;
				vm.selectedTasks = tasks.data.result;
			})
			.then(getCallResolution)
			.catch(errorService.show);
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'crr/crr-settings.html',
				controller: 'CrrSettingsController',
				controllerAs: 'crrSettsVm',
				parent: angular.element(document.body),
				locals: {
					tasks: vm.tasks,
					selectedTasks: vm.selectedTasks
				}
			}).then(function(result) {
				vm.selectedTasks = result.selectedTasks;
				getCallResolution();
			});
		}

		function getCallResolution() {
			var tables = vm.settings.tables;

			spinnerService.show('crr-loader');

			return getAgentsStat(tables, vm.begin.valueOf(), vm.end.valueOf())
			.then(function(astat) {
				debug.log('getAgentsStat data: ', astat.data.result);
				agentStat = astat.data.result
				return getPerfStat(tables, vm.begin.valueOf(), vm.end.valueOf());
			})
			.then(function(pstat) {
				debug.log('getPerfStat data: ', pstat.data.result);
				perfStat = pstat.data.result;
				vm.stat = angular.merge([], agentStat, perfStat);
				vm.stat.map(addPerfValue);

				return api.getFCRStatistics({
					task: vm.tasks[0],
					table: [tables.calls.name],
					procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
					interval: 3600*24*1000,
					begin: vm.begin.valueOf(), 
					end: vm.end.valueOf()
				});
			})
			.then(function(fcr) {
				agentsFcr = arrayToObjectAndSum(fcr.data.result, 'agent');
				debug.log('fcr: ', agentsFcr);
				vm.stat.map(addFcrValue);
				spinnerService.hide('crr-loader');
			})
			.catch(errorService.show);
		}

		function getAgentsStat(tables, begin, end){
			var data,
			metrics = ['count(*)','sum(connectTime)','avg(connectTime)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.tasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.operator],
				begin: begin,
				end: end,
				metrics: metrics
			});
		}

		function getPerfStat(tables, begin, end){
			var data,
			metrics = ['count(callresult)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				tabrel: 'taskid in (\''+vm.tasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid'+
						' and '+[tables.calls.name, tables.calls.columns.callresult].join('.')+'=1',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult, tables.calls.columns.operator],
				begin: begin,
				end: end,
				metrics: metrics
			});
		}

		function addPerfValue(item) {
			item.perf = item['count(callresult)'] / item['count(*)'] * 100;
			return item;
		}

		function addFcrValue(item) {
			var currFcr = agentsFcr[item.operator];
			item.fcr = currFcr !== undefined ? (currFcr.fcr / currFcr.total * 100) : null;
			return item;
		}

		function arrayToObject(array, propName) {
			return array.reduce(function(prev, next) {
				if(next.hasOwnProperty(propName)) {
					prev[next[propName]] = next;
					return prev;
				}
			}, {});
		}

		function arrayToObjectAndSum(array, propName) {
			return array.reduce(function(prev, next) {
				if(next.hasOwnProperty(propName)) {
					prev[next[propName]] = prev[next[propName]] ? sumObjects(next, prev[next[propName]]) : next;
					
					return prev;
				}
			}, {});
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
angular.module('app.crr')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/crr', {
			templateUrl: 'crr/crr.html',
			controller: 'CrrController',
			controllerAs: 'crrVm'
		});
}]);
(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashExportController', DashExportController);

	DashExportController.$inject = ['$mdDialog', 'kinds', 'tables', 'data', 'begin', 'end', 'stat', 'prevstat', 'catstat'];

	function DashExportController($mdDialog, kinds, tables, data, begin, end, stat, prevstat, catstat) {

		var vm = this;

		vm.kinds = kinds;
		vm.tables = tables;
		vm.data = data;
		vm.begin = begin;
		vm.end = end;
		vm.stat = stat;
		vm.prevstat = prevstat;
		vm.catstat = catstat;
		vm.close = function(){
			$mdDialog.hide();
		};

	}

})();
(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashSettingsController', DashSettingsController);

	DashSettingsController.$inject = ['$mdDialog', 'options'];

	function DashSettingsController($mdDialog, options) {

		var vm = this;

		vm.options = angular.copy(options, {});
		vm.periods = ['1 hour', '1 day', '1 week', '1 month', '6 months', '1 year'];
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
(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('DashController', DashController);

	DashController.$inject = ['$rootScope', '$scope', '$timeout', '$q', '$mdMedia', '$mdBottomSheet', '$mdDialog', '$mdToast', 'store', 'SettingsService', 'apiService', 'spinnerService', 'chartService', 'debugService', 'errorService', 'utilsService'];

	function DashController($rootScope, $scope, $timeout, $q, $mdMedia, $mdBottomSheet, $mdDialog, $mdToast, store, SettingsService, api, spinnerService, chartService, debug, errorService, utils) {

		var vm = this;
		var defaultData = {
			Incoming_Agent: {
				kind: 1,
				tasks: [],
				list: [],
				sl: 20,
				metrics: ['aht', 'att', 'nco', 'nca', 'car', 'asa']
			},
			Messaging_Chat: {
				kind: 7,
				tasks: [],
				list: [],
				sl: 5,
				metrics: ['aht', 'att', 'nco', 'nca', 'car']
			},
			Autodial_Agent: {
				kind: 129,
				tasks: [],
				list: [],
				metrics: ['aht', 'att', 'nco', 'nca']
			},
			defaults: {
				tasks: [],
				list: [],
				sl: 20,
				metrics: ['aht', 'att', 'nco', 'nca', 'car']
			}
				
		},
		defaultOptions = {
			autoupdate: false,
			updateEvery: '1 minutes',
			kinds: [{name: 'Incoming_Agent', kind: 1}],
			kindsList: [{name: 'Incoming_Agent', kind: 1}, {name: 'Messaging_Chat', kind: 7}, {name: 'Autodial_Agent', kind: 129}],
			// kinds: [1, 7, 129],
			sl: [5, 10, 15, 20, 25, 30, 35, 40],
			db: {},
			tables: [],
			period: '1 day',
			catColours: [],
			catorder: 'catdesc' // changed during the dashboard initiation to the value from the config file
		},
		updateTimeout = null;

		vm.options = getDefaultOptions();
		vm.data = getDefaultData();
		vm.begin = utils.periodToRange(vm.options.period).begin;
		vm.end = utils.periodToRange(vm.options.period).end;
		vm.stat = {};
		vm.prevstat = {};
		vm.catstat = [];
		vm.globalCr = {};
		vm.globalFcr = {};
		vm.prevGlobalFcr = {};
		// vm.catTotals = {};
		// vm.subcatTotals = {};
		vm.selectedCat = null;
		vm.subCatsStat = [];
		vm.catchartData = {};
		vm.catchartLabel = 'nca';
		vm.chartOptions = {
			layout: {
				padding: {
					left: 40,
					right: 40
				}
			}
		};
		vm.catMetrics = [{ index: 'nca', name: 'Number of calls answered' }, { index: 'aht', name: 'Average handle time' }, { index: 'att', name: 'Average talk time' }];
		vm.totalByCategory = {};
		vm.userFullScreen = $mdMedia('xs');
		vm.abRate = utils.getAbandonmentRate;
		// vm.getFriendlyKind = getFriendlyKind;
		vm.openDashSettings = openDashSettings;
		vm.onCatSelect = onCatSelect;
		vm.onSubCatSelect = onSubCatSelect;
		vm.getStat = getStat;
		vm.openSettings = openSettings;
		vm.exportDash = exportDash;

		$scope.$watch(function() {
			return vm.options;
		}, function(newValue, prevValue) {
			debug.log('Options changed!!!', newValue);
			store.set('options', newValue);
		});
		$scope.$watch(function() {
			return vm.catchartLabel;
		}, function(newValue, prevValue) {
			if(vm.selectedCat)
				vm.catchartData = chartService.setChartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description, vm.catchartLabel);
			else
				if(vm.options.db.tables) vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description, vm.catchartLabel);
		});
		$scope.$on('$destroy', function() {
			$timeout.cancel(updateTimeout);
			updateTimeout = null;
		});

		// Get DB settings and init the Dashboard
		SettingsService.getSettings()
		.then(function(dbSettings){
			debug.log('DB settings', dbSettings);
			var tables = dbSettings.tables,
				options = {
					db: dbSettings,
					tablesList: [],
					callstable: tables.calls ? tables.calls : null,
					cattable: tables.categories ? tables.categories : null,
					subcattable: tables.subcategories ? tables.subcategories : null,
					catorder: tables.categories ? tables.categories.columns.description : null
				};

			angular.extend(vm.options, options);
			angular.forEach(tables, function(item){
				if(item.name) vm.options.tablesList.push(item.name);
			});
			
			init();
			autoUpdate();
		});

		function init(){
			if(!vm.options.kinds.length) return spinnerService.hide('main-loader');

			vm.options.kinds.forEach(function(item, index, array) {
				api.getTasks({ kind: item.kind })
				.then(function(result) {
					return setTasks(result, item);
				})
				.then(function(tasks) {
					return getStatData(vm.data[item.name].list || tasks, item);
				})
				.then(function(){
					if(vm.options.callstable && vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.cattable) {
						return getCategoriesStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(getGlobalFrc)
				.then(function(){
					if(index === array.length-1) spinnerService.hide('main-loader');
				})
				.catch(errorService.show);
			});
		}

		function autoUpdate(){
			var dur = vm.options.updateEvery.split(' ');
			updateTimeout = $timeout(function() {
				if(vm.options.autoupdate) vm.getStat();
				autoUpdate();
			}, moment.duration(parseInt(dur[0], 10), dur[1])._milliseconds);
		}

		function getStat(kinds) {
			var kindsList = kinds || vm.options.kinds;
			kindsList.forEach(function(item) {
				spinnerService.show(item.name+'-loader');
				getStatData(vm.data[item.name].list, item)
				.then(function(){
					if(vm.options.callstable && vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(getGlobalFrc)
				.then(function(){ spinnerService.hide(item.name+'-loader'); })
				.catch(function(){ spinnerService.hide(item.name+'-loader'); });
			});

			if(vm.options.cattable) getCategoriesStat();

			$mdToast.show(
				$mdToast.simple()
					.textContent('Updating indexes')
					.position('top right')
					.hideDelay(2000)
			);
		}

		function openDashSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/dash-settings.html',
				controller: 'DashSettingsController',
				controllerAs: 'dashSetVm',
				parent: angular.element(document.body),
				locals: {
					options: vm.options
				},
				fullscreen: vm.userFullScreen
			}).then(function(result) {
				spinnerService.show('main-loader');
				vm.options = result.options;
				init();
			});
		}

		function onCatSelect(cat, index) {
			if(vm.selectedCat && (!cat || cat[vm.options.callstable.columns.category] === vm.selectedCat[vm.options.callstable.columns.category])) {
				vm.selectedCat = null;
				vm.subCatsStat = [];
				vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description, vm.catchartLabel);
				return;
			}
			else vm.selectedCat = cat;

			getSubCategoriesStat(cat[vm.options.callstable.columns.category])
			.then(function(result) {
				var data = result.data, totals = {};
				if(data.error) return errorService.show(data.error.message);
				// if(!data.result.length) return;

				// vm.subcatTotals = data.result.reduce(utils.getTotals);
				vm.subCatsStat = data.result.length ? setCatsStat(data.result, data.result.reduce(utils.getTotals)) : data.result;
				vm.catchartData = chartService.setChartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description, vm.catchartLabel);
			})
			.catch(errorService.show);
		}

		function onSubCatSelect(cat, subcat, index) {
			var tables = vm.options.db.tables,
				tcols = tables.calls.columns,
				columns = [tcols.operator, tcols.customer_phone, tcols.calldate, tcols.comments],
				data;

			debug.log('onSubCatSelect: ', cat, subcat, index);

			if(tables.calls.columns.company) columns.push(tables.companies.columns.description);
			if(tables.calls.columns.customer_name) columns.push(tables.calls.columns.customer_name);
			if(tables.calls.columns.callresult) columns.push(tables.calls.columns.callresult);

			getCatProcesses(columns, cat, subcat).then(function(result) {
				data = result.data;
				if(data.error) return errorService.show(data.error.message);
				vm.processes = utils.queryToObject(data.result, columns);
				$mdDialog.show({
					templateUrl: 'dashboard/export-processes.html',
					locals: {
						tables: vm.options.db.tables,
						begin: vm.begin,
						end: vm.end,
						data: vm.processes
					},
					controller: 'ProcessesExportController',
					controllerAs: 'procExpVm',
					parent: angular.element(document.body),
					fullscreen: vm.userFullScreen
				});
			});
		}

		function openSettings($event, kind) {
			var data = vm.data[kind.name];
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/kind-settings.html',
				controller: 'KindSettingsController',
				controllerAs: 'kindSetVm',
				locals: {
					kind: kind,
					list: data.list,
					tasks: data.tasks,
					kindMetrics: data.metrics,
					metrics: defaultData[kind.name].metrics,
					sl: data.sl || null,
					defaultSL: vm.options.sl
				},
				parent: angular.element(document.body),
				fullscreen: vm.userFullScreen
			}).then(function(opts) {
				if(opts.sl) data.sl = opts.sl;
				data.metrics = opts.metrics;
				data.list = opts.list;

				// Update data
				vm.getStat([kind]);

				// Save new data to storage
				store.set('data', vm.data);
			});
		}

		function exportDash($event, kinds) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'dashboard/export-dialog.html',
				locals: {
					kinds: kinds || vm.options.kinds,
					data: vm.data,
					tables: vm.options.db.tables,
					begin: vm.begin,
					end: vm.end,
					stat: vm.stat,
					prevstat: vm.prevstat,
					catstat: vm.catstat
				},
				controller: 'DashExportController',
				controllerAs: 'dashExpVm',
				parent: angular.element(document.body),
				fullscreen: vm.userFullScreen
			});
		}

		function getDefaultData(){
			var data = store.get('data');
			if(!data) {
				data = defaultData;
				store.set('data', data);
			}
			return data;
		}

		function getDefaultOptions(){
			var options = store.get('options');
			if(!options) {
				options = defaultOptions;
			}
			return options;
		}

		function getTasksStatistics(params, obj){
			return api.getTaskGroupStatistics(params).then(function(result) {
				var data = result.data;

				if(data.error) return errorService.show(data.error.message);
				if(data.result.length) angular.extend(obj, data.result.reduce(utils.extendAndSum));
			});
		}

		function getStatData(tasks, kind){
			return $q(function(resolve, reject) {
				// if(!tasks.length) return reject();

				var currParams = {},
					prevParams = {},
					fkind = kind.name,
					data = vm.data[fkind],
					metrics = data.metrics || vm.data[fkind].metrics,
					slIndex = utils.getSlIndex(metrics);

				currParams = {
					begin: new Date(vm.begin).valueOf(),
					end: new Date(vm.end).valueOf(),
					list: tasks,
					metrics: metrics
				};

				if(data.sl && slIndex === -1) {
					currParams.metrics.push('sl'+data.sl);
				} else if(data.sl && metrics[slIndex] !== 'sl'+data.sl) {
					currParams.metrics[slIndex] = 'sl'+data.sl;
				}

				angular.extend(prevParams, currParams);
				prevParams.begin = currParams.begin - (currParams.end - currParams.begin);
				prevParams.end = currParams.begin;
				
				vm.stat[fkind] = tasks.length ? (vm.stat[fkind] || {}) : {};
				vm.prevstat[fkind] = tasks.length ? (vm.prevstat[fkind] || {}) : {};

				getTasksStatistics(currParams, vm.stat[fkind]).then(function(){
					return getTasksStatistics(prevParams, vm.prevstat[fkind]);
				}).then(function(){
					resolve();
				});

			});
		}

		/**
		 * Save array of tasks to scope variables
		 * @param {Object} result - object, which is returned from getTasks query or an array of tasks
		 */
		function setTasks(result, kind){
			var data = result.data,
				tasks = data ? data.result : result,
				fkind = kind.name;

			return $q(function(resolve, reject) {
				if(data && data.err) return reject(data.err.message);
				if(!tasks) return reject('Tasks is undefined');

				if(!vm.data[fkind]) {
					vm.data[fkind] = defaultData.defaults;
				}
				vm.data[fkind].tasks = [].concat(tasks);
				if(!vm.data[fkind].list.length) vm.data[fkind].list = [].concat(tasks);

				resolve(tasks);
			});
		}

		function getCategoriesStat(){
			var data, tables = vm.options.db.tables,
			metrics = ['nca', 'att', 'aht', 'asa', 'sl'+vm.data.Incoming_Agent.sl];
			
			if(tables.calls.columns.callresult) {
				metrics.push('sum(callresult)');
				// vm.catMetrics.push({ index: 'sum(callresult)', name: 'Call resolution' });
			}

			vm.options.tablesList = [tables.calls.name, tables.categories.name];
			// if(tables.companies) vm.options.tablesList.push(tables.companies.name);

			spinnerService.show('categories-loader');
			api.getCustomListStatistics({
				// tables: ['probstat', 'probcat', 'probcompany'],
				tables: vm.options.tablesList,
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: [tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						// ' and tasktype in ('+getTaskKinds().join(',')+')'+
						' and taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid',
						// (tables.calls.columns.company ?
						// ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') :
						// ''),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.category, tables.categories.columns.description],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(function(result) {
				
				spinnerService.hide('categories-loader')

				data = result.data;
				if(data.error) return errorService.show(data.error.message);
				
				// vm.catTotals = data.result.reduce(utils.getTotals);
				vm.catstat = data.result.length ? setCatsStat(data.result, data.result.reduce(utils.getTotals)) : data.result;
				debug.log('getCategoriesStat catstat: ', vm.catstat);
				vm.catchartData = chartService.setChartData(vm.catstat, vm.catchartLabel, tables.categories.columns.description, vm.catchartLabel);
				debug.log('getCategoriesStat vm.catchartData: ', vm.catchartData);
				spinnerService.hide('categories-loader');
			})
			.catch(errorService.show);

		}

		function getSubCategoriesStat(cat){
			var data, tables = vm.options.db.tables,
			metrics = ['nca', 'att', 'aht', 'asa', 'sl'+vm.data.Incoming_Agent.sl];
			if(tables.calls.columns.callresult) metrics.push('sum(callresult)');

			spinnerService.show('categories-loader');
			return api.getCustomListStatistics({
				// tables: ['probstat', 'probcat', 'probdetails'],
				tables: [tables.calls.name, tables.categories.name, tables.subcategories.name],
				// tabrel: 'probcat.catdesc="'+cat+'" and probstat.probcat=probcat.catid and probstat.probdetails=probdetails.subid',
				tabrel: [tables.categories.name, tables.categories.columns.id].join('.')+'='+cat+
						// ' and tasktype in ('+getTaskKinds().join(',')+')'+
						' and taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid'+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.'),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.subcategories.columns.id, tables.subcategories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getSubCategoriesStat data: ', result.data);
				spinnerService.hide('categories-loader');
				return result;
			});
		}

		function getCatProcesses(columns, cat, subcat){
			if(!columns) return;
			var tables = vm.options.db.tables;
			vm.options.tablesList = [tables.processed.name, tables.calls.name, tables.categories.name, tables.subcategories.name];
			if(tables.companies) vm.options.tablesList.push(tables.companies.name);

			spinnerService.show('categories-loader');
			return api.getQueryResultSet({
				// tables: ['processed', 'probstat', 'probcat', 'probdetails', 'probcompany'],
				tables: vm.options.tablesList,
				// tabrel: (cat ? 'probcat.catdesc="'+cat+'" and ' : '') + (subcat ? 'probdetails.probdesc="'+subcat+'" and ' : '') + 'probstat.probcat=probcat.catid and probstat.probdetails=probdetails.subid and probstat.probcompany=probcompany.compid',
				tabrel: (cat !== undefined ? [tables.categories.name, tables.categories.columns.id].join('.')+'='+cat+' and ' : '') +
						' taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+
						(subcat !== undefined ? ' and '+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+'='+subcat : '') +
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						(tables.calls.columns.subcategory !== undefined ? ' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') : '')+
						(tables.calls.columns.company !== undefined ? ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') : '') +
						' and processed.procid='+[tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: columns,
				// groupBy: tables.calls.columns.comments,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			}).then(function(result){
				spinnerService.hide('categories-loader');
				return result;
			});
		}

		function getCallResolutionStat(){
			var data, tables = vm.options.db.tables, taskKind = 1,
			metrics = ['count(callresult)'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: 'taskid in (\''+getTaskIds([taskKind]).join('\',\'')+'\')'+
						'and '+[tables.calls.name, tables.calls.columns.callresult].join('.')+' = 1',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getCallResolutionStat data: ', result.data);
				if(result.data.result.length) {
					vm.globalCr[utils.getFriendlyKind(taskKind)] = result.data.result[0]['count(callresult)'];
					debug.log('globalCr: ', vm.globalCr[utils.getFriendlyKind(taskKind)]);
					return result;
				}
			});
		}

		function getGlobalFrc() {
			var tables = vm.options.db.tables,
				taskKind = 1,
				tasks = getTaskIds([taskKind]);

			debug.log('getGlobalFrc tasks:', tasks[0]);

			return api.getCustomFCRStatistics({
				task: tasks[0],
				// table: [tables.calls.name],
				// procid: tables.calls.columns.process_id,
				interval: 3600*24*1000,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			})
			.then(function(result) {
				vm.globalFcr = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.globalFcr.fcrRate = vm.globalFcr.fcr / vm.globalFcr.total * 100;

				debug.log('getGlobalFrc: ', vm.globalFcr);

				// get prev statistics
				return api.getCustomFCRStatistics({
					task: tasks[0],
					// table: [tables.calls.name],
					// procid: tables.calls.columns.process_id,
					interval: 3600*24*1000,
					begin: (vm.begin.valueOf() - (vm.end.valueOf() - vm.begin.valueOf())),
					end: vm.begin.valueOf()
				});

			})
			.then(function(result) {
				vm.prevGlobalFcr = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.prevGlobalFcr.fcrRate = vm.prevGlobalFcr.fcr / vm.prevGlobalFcr.total * 100;

				debug.log('prevGlobalFcr: ', vm.prevGlobalFcr);
			})
		}

		function getLoginsRatio() {
			var data, tables = vm.options.db.tables, taskKind = 1,
			rdata = {},
			metrics = ['count(login)'];
			// metrics = ['count(case when login != 0 then login else null end) as tlogins'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: 'taskid in (\''+getTaskIds([taskKind]).join('\',\'')+'\')' +
						"and "+[tables.calls.name, tables.calls.columns.login].join('.')+" != '0'",
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.callresult],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getLoginsRatio data: ', result.data);
				if(result.data && result.data.result && result.data.result.length) {
					rdata = result.data.result;
					vm.stat = vm.stat || {};
					vm.stat[utils.getFriendlyKind(taskKind)] = vm.stat[utils.getFriendlyKind(taskKind)] || {};
					vm.stat[utils.getFriendlyKind(taskKind)].ncu = rdata.reduce(function(prev, next) { 
						return prev + next['count(login)']; 
					}, 0);
					
					debug.log('getLoginsRatio stat: ', vm.stat[utils.getFriendlyKind(taskKind)]);
					return result;
				}
			});
		}

		function setCatsStat(data, totals){
			var dataValue;
				// totals = data.reduce(utils.getTotals);

			return utils.setPercentageValues(data, totals).map(function(item){
				angular.forEach(item, function(value, key){
					dataValue = parseFloat(value);

					if(!isNaN(dataValue)) item[key] = dataValue;
				});
				return item;
			});
		}

		// function setChartData(array, datakey, labelkey){
		// 	var newArray = [], data = [], labels = [], colours = [], itemData;

		// 	sortObjBy(array, datakey, 'descend')
		// 	.map(function(item){
		// 		data.push(angular.isNumber(item[datakey]) ? item[datakey].toFixed(2) : item[datakey] );
		// 		labels.push(item[labelkey]);
		// 		colours.push(getCategoryColour(item[labelkey]));
		// 	});
			
			
		// 	store.set('options', vm.options);

		// 	return {
		// 		data: data,
		// 		labels: labels,
		// 		colours: colours
		// 	};
		// }

		// function getCategoryColour(cat){
		// 	var catColours = vm.options.catColours,
		// 		found = false, colour = '';

		// 	catColours.forEach(function(item){
		// 		if(item.name === cat) found = item;
		// 	});

		// 	if(found) {
		// 		colour = found.colour;
		// 	} else {
		// 		colour = colourGenerator.getColor();
		// 		vm.options.catColours.push({ name: cat, colour: colour });
		// 	}
		// 	return colour;
		// }


		// function sortObjBy(array, key, descend){
		// 	var sorted = array.sort(function(a, b){
		// 		if(a[key] > b[key]) return descend ? -1 : 1;
		// 		if(a[key] < b[key]) return descend ? 1 : -1;
		// 		return 0;
		// 	});
		// 	return sorted;
		// }

		function getTaskKinds(){
			return vm.options.kinds.map(function(item){ return item.kind; });
		}

		function getTaskIds(kinds){
			var ids = [];
			angular.forEach(vm.data, function(value, key){
				if(value.list.length) {
					if(kinds) {
						if(kinds.indexOf(value.kind) > -1) ids.push(value.list);
					} else {
						ids.push(value.list);
					}
				}
			});

			if(ids.length) {
				return ids.reduce(function(prev, curr){
					return prev.concat(curr);
				});
			} else {
				return ids;
			}
		}

	}

})();
angular.module('app.dashboard')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/dashboard', {
			templateUrl: 'dashboard/dashboard.html',
			controller: 'DashController',
			controllerAs: 'dashVm'
		});
}]);
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
(function(){

	'use strict';

	angular
		.module('app.dashboard')
		.controller('ProcessesExportController', ProcessesExportController);

	ProcessesExportController.$inject = ['$scope', '$filter', '$mdDialog', 'tables', 'begin', 'end', 'data', 'utilsService', 'debugService'];

	function ProcessesExportController($scope, $filter, $mdDialog, tables, begin, end, data, utils, debug) {

		var vm = this;

		vm.tables = tables;
		vm.begin = begin;
		vm.end = end;
		vm.data = data;

		debug.log('ProcessesExportController: ', vm.data);

		vm.order = tables.calls.columns.calldate,
		vm.search = '';
		vm.filter = {
			callresult: ''
		};

		vm.exportName = 'processes';
		// vm.exportName = $filter('date')(vm.begin, 'dd.MM.yy') + '-' + $filter('date')(vm.end, 'dd.MM.yy');

		vm.filterByResult = function(actual, expected) {
			return vm.filter.callresult ? (actual.callresult.toString() === vm.filter.callresult) : true;

		};

		vm.close = function(){
			$mdDialog.hide();
		};

	}

})();
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

		init();
		spinnerService.show('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return TasksService.getTaskList(1);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks.data.result);
				vm.tasks = tasks.data.result;
				vm.selectedTasks = store.get('selectedTasks') || tasks.data.result;
				vm.selectedCats = store.get('selectedCats') || [];
				vm.selectedSubcats = store.get('selectedSubcats') || [];

				spinnerService.hide('main-loader');

				return $q(function(resolve, reject) {
					resolve();
				});
			})
			.then(getCategories)
			.then(getSubcategories)
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
			
			return api.getQueryResultSet({
				tables: [tables.categories.name],
				columns: [tables.categories.columns.description, tables.categories.columns.id],
				groupBy: tables.categories.columns.description
			}).then(function(cats){
				vm.cats = cats.data.result.length ? (cats.data.result.map(function(cat) { return { desc: cat[0], id: cat[1] } })) : [];
				vm.selectedCats = vm.selectedCats.length ? vm.selectedCats : [].concat(vm.cats).map(function(item) { return item.id });
				debug.log('getCategories: ', vm.cats, vm.selectedCats);

			})
			.catch(errorService.show);
		}

		function getSubcategories(){
			var tables = vm.settings.tables;
			
			return api.getQueryResultSet({
				tables: [tables.categories.name, tables.subcategories.name],
				columns: [tables.categories.columns.description, tables.categories.name+'.'+tables.categories.columns.id, tables.subcategories.columns.description, tables.subcategories.columns.id],
				tabrel: tables.subcategories.name+'.'+tables.subcategories.columns.category_id+'='+tables.categories.name+'.'+tables.categories.columns.id,
				groupBy: [tables.categories.columns.description, tables.subcategories.columns.description]
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
				task: vm.tasks[0],
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
					task: vm.selectedTasks[0],
					table: [tables.calls.name, tables.categories.name, tables.subcategories.name],
					where: [tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.') +
							' and ' + [tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') +
							' and ' + [tables.categories.name, tables.categories.columns.id].join('.')+' in '+arrayToIn(vm.selectedCats) +
							' and ' + [tables.subcategories.name, tables.subcategories.columns.id].join('.')+' in '+arrayToIn(vm.selectedSubcats),
					procid: tables.calls.columns.process_id,
					column: [tables.categories.columns.description, tables.subcategories.columns.description],
					interval: defaultOptions.interval,
					begin: vm.begin.valueOf(),
					end: vm.end.valueOf()
				};

			spinnerService.show('cat-fcr-loader');

			return api.getCustomFCRStatistics(params)
			.then(function(result) {
				catFcr = arrayToObjectAndSum(result.data.result, 'catdesc');
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
				task: vm.selectedTasks[0],
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
			return '("' + array.join('","') + '")';
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
angular.module('app.fcr')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/fcr', {
			templateUrl: 'fcr/fcr.html',
			controller: 'FcrController',
			controllerAs: 'fcrVm'
		});
}]);
angular.module('app')
.filter('convertBytes', function() {
  return function(integer, fromUnits, toUnits) {
    var coefficients = {
        'Byte': 1,
        'KB': 1000,
        'MB': 1000000,
        'GB': 1000000000
    };
    return integer * coefficients[fromUnits] / coefficients[toUnits];
  };
})
.filter('average', function() {
	return function(value, number) {
		if(value === undefined) return;
		
		return parseFloat(value) / (number || 1);
	};
})
.filter('timer', function() {
	return function(value, fraction) {
		if(value === undefined) return;
		
		var filtered = parseFloat(value),
			hh = 0, mm = 0, ss = 0;

		function prepare(number){
			return Math.floor(number) > 9 ? Math.floor(number) : '0'+Math.floor(number);
		}

		hh = filtered / 3600;
		mm = (filtered % 3600) / 60;
		ss = (mm % 1)/100*60*100;

		return prepare(hh)+':'+prepare(mm)+':'+prepare(ss);
	};
})
.filter('duration', function() {
	return function(value, fraction) {
		if(value === undefined) return;
		
		var filtered = parseFloat(value),
			prefix = 's';

		if(filtered > 3600) {
			filtered = filtered / 3600;
			prefix = 'h';
		} else if(filtered > 60) {
			filtered = filtered / 60;
			prefix = 'm';
		} else {
			filtered = filtered;
		}
		return filtered.toFixed(fraction || 2) + ' ' + prefix;
	};
})
.filter('diff', function() {
	return function(prevvalue, nextvalue, unit) {
		if(prevvalue === undefined && nextvalue === undefined) return;

		var intPrevValue = prevvalue ? parseFloat(prevvalue) : 0,
			intNextValue = nextvalue ? parseFloat(nextvalue) : 0,
			filtered, diff, prefix = '+', dynamics = true;

		if(intPrevValue > intNextValue) {
			diff = intPrevValue - intNextValue;
			filtered = diff * 100 / intPrevValue;
			prefix = '-';
			dynamics = false;
		} else {
			diff = intNextValue - intPrevValue;
			filtered = diff * 100 / intNextValue;
		}

		if(unit === 'value') {
			return prefix+diff;
		} else if(unit === 'dynamics') {
			return dynamics;
		} else if(unit === 'dynamics-reverse') {
			return !dynamics;
		} else {
			return prefix+filtered.toFixed(1)+'%';
		}
	};
})
.filter('dynamics', function() {
	return function(value1, value2) {
		if(value1 === undefined && value2 === undefined) return;

		return parseFloat(value1) > parseFloat(value2) ? 'positive' : 'negative';
	};
});
(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('LayoutController', LayoutController);

	LayoutController.$inject = ['$rootScope'];

	function LayoutController($rootScope) {

		var vm = this;

		
	}

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('apiService', apiService);

    apiService.$inject = ['$http', 'appConfig', 'errorService', 'debugService'];

    function apiService($http, appConfig, errorService, debug){

        var baseUrl = appConfig.server;

        return {
            getDbSettings: getDbSettings,
            getTasks: getTasks,
            getFCRStatistics: getFCRStatistics,
            getCustomFCRStatistics: getCustomFCRStatistics,
            getTaskGroupStatistics: getTaskGroupStatistics,
            getCustomListStatistics: getCustomListStatistics,
            getQueryResultSet: getQueryResultSet

        };

        function getDbSettings() {
            return $http.get('/stat/db.json');
        }

        function getTasks(params, cb) {
            var reqParams = {
                method: 'getTasks',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getFCRStatistics(params, cb) {
            var reqParams = {
                method: 'getFCRStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getCustomFCRStatistics(params, cb) {
            var reqParams = {
                method: 'getCustomFCRStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);   
        }

        function getTaskGroupStatistics(params) {
            var reqParams = {
                method: 'getTaskGroupStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getCustomListStatistics(params) {
            var reqParams = {
                method: 'getCustomListStatistics',
                params: params
            };
            return $http.post(baseUrl, reqParams);
        }

        function getQueryResultSet(params) {
            var SELECT = 'SELECT ' + params.columns;
            var FROM = 'FROM ' + params.tables;
            var WHERE = (params.tabrel || params.begin) ? 'WHERE ' : '';
            var GROUPBY = params.groupBy ? ('GROUP BY ' + params.groupBy) : '';

            WHERE += params.tabrel ? params.tabrel : '';
            WHERE += params.begin ? 
                    ( (WHERE ? ' and ' : '') + 'timestart between ' + moment(params.begin).unix() + ' and ' + moment(params.end).unix() ) : '';

            var reqParams = {
                method: 'getQueryResultSet',
                params: {
                    query: [SELECT, FROM, WHERE, GROUPBY].join(' ')
                    // query: ['SELECT', params.columns, 'FROM', params.tables, 'WHERE', 'processed.procid='+params.procid, 'and', params.tabrel, 'and timestart between', moment(params.begin).unix(), 'and', moment(params.end).unix(), (params.groupBy ? 'group by '+params.groupBy : '')].join(' ')
                }
            };
            return $http.post(baseUrl, reqParams);
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('chartService', chartService);

    chartService.$inject = ['utilsService', 'colourGenerator', 'store'];

    function chartService(utilsService, colourGenerator, store){

        var usedColours = store.get('colours') || [];

        return {
            setChartData: setChartData,
            getChartColour: getChartColour
        };

        function setChartData(array, datakey, labelkey, orderBy){
            var data = [], labels = [], colours = [];

            if(orderBy) 
                array = utilsService.sortObjBy(array, orderBy, 'descend');

            array
            .map(function(item){
                data.push(angular.isNumber(item[datakey]) ? parseFloat(item[datakey].toFixed(2)) : item[datakey] );
                labels.push(item[labelkey]);
                colours.push(getChartColour(item[labelkey]));
            });
            
            
            return {
                data: data,
                labels: labels,
                colours: colours
            };
        }

        function getChartColour(cat){
            var found = false, colour = '';

            usedColours.forEach(function(item){
                if(item.name === cat) found = item;
            });

            if(found) {
                colour = found.colour;
            } else {
                colour = colourGenerator.getColor();
                usedColours.push({ name: cat, colour: colour });
                store.set('colours', usedColours)
            }
            return colour;
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('colourGenerator', colourGenerator);

    function colourGenerator(){

        // https://www.npmjs.com/package/random-material-color

        var defaultPalette = {
            // Red, Pink, Purple, Deep Purple, Indigo, Blue, Light Blue, Cyan, Teal, Green, Light Green, Lime, Yellow, Amber, Orange, Deep Orange, Brown, Grey, Blue Grey
            '50': ['#FFEBEE', '#FCE4EC', '#F3E5F5', '#EDE7F6', '#E8EAF6', '#E3F2FD', '#E1F5FE', '#E0F7FA', '#E0F2F1', '#E8F5E9', '#F1F8E9', '#F9FBE7', '#FFFDE7', '#FFF8E1', '#FFF3E0', '#FBE9E7', '#EFEBE9', '#FAFAFA', '#ECEFF1'],
            '100': ['#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', '#BBDEFB', '#B3E5FC', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8', '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC', '#D7CCC8', '#F5F5F5', '#CFD8DC'],
            '200': ['#EF9A9A', '#F48FB1', '#CE93D8', '#B39DDB', '#9FA8DA', '#90CAF9', '#81D4FA', '#80DEEA', '#80CBC4', '#A5D6A7', '#C5E1A5', '#E6EE9C', '#FFF59D', '#FFE082', '#FFCC80', '#FFAB91', '#BCAAA4', '#EEEEEE', '#B0BEC5'],
            '300': ['#E57373', '#F06292', '#BA68C8', '#9575CD', '#7986CB', '#64B5F6', '#4FC3F7', '#4DD0E1', '#4DB6AC', '#81C784', '#AED581', '#DCE775', '#FFF176', '#FFD54F', '#FFB74D', '#FF8A65', '#A1887F', '#E0E0E0', '#90A4AE'],
            '400': ['#EF5350', '#EC407A', '#AB47BC', '#7E57C2', '#5C6BC0', '#42A5F5', '#29B6F6', '#26C6DA', '#26A69A', '#66BB6A', '#9CCC65', '#D4E157', '#FFEE58', '#FFCA28', '#FFA726', '#FF7043', '#8D6E63', '#BDBDBD', '#78909C'],
            '500': ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B'],
            '600': ['#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047', '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00', '#F4511E', '#6D4C41', '#757575', '#546E7A'],
            '700': ['#D32F2F', '#C2185B', '#7B1FA2', '#512DA8', '#303F9F', '#1976D2', '#0288D1', '#0097A7', '#00796B', '#388E3C', '#689F38', '#AFB42B', '#FBC02D', '#FFA000', '#F57C00', '#E64A19', '#5D4037', '#616161', '#455A64'],
            '800': ['#C62828', '#AD1457', '#6A1B9A', '#4527A0', '#283593', '#1565C0', '#0277BD', '#00838F', '#00695C', '#2E7D32', '#558B2F', '#9E9D24', '#F9A825', '#FF8F00', '#EF6C00', '#D84315', '#4E342E', '#424242', '#37474F'],
            '900': ['#B71C1C', '#880E4F', '#4A148C', '#311B92', '#1A237E', '#0D47A1', '#01579B', '#006064', '#004D40', '#1B5E20', '#33691E', '#827717', '#F57F17', '#FF6F00', '#E65100', '#BF360C', '#3E2723', '#212121', '#263238'],
            'A100': ['#FF8A80', '#FF80AB', '#EA80FC', '#B388FF', '#8C9EFF', '#82B1FF', '#80D8FF', '#84FFFF', '#A7FFEB', '#B9F6CA', '#CCFF90', '#F4FF81', '#FFFF8D', '#FFE57F', '#FFD180', '#FF9E80'],
            'A200': ['#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'],
            'A400': ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#3D5AFE', '#2979FF', '#00B0FF', '#00E5FF', '#1DE9B6', '#00E676', '#76FF03', '#C6FF00', '#FFEA00', '#FFC400', '#FF9100', '#FF3D00'],
            'A700': ['#D50000', '#C51162', '#AA00FF', '#6200EA', '#304FFE', '#2962FF', '#0091EA', '#00B8D4', '#00BFA5', '#00C853', '#64DD17', '#AEEA00', '#FFD600', '#FFAB00', '#FF6D00', '#DD2C00']
        };

        /* usedColors = [{ text:SomeText, color: SomeColor }] */
        var usedColors = [];
        var defaultOptions = {
            shades: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'A100', 'A200', 'A400', 'A700'],
            palette: defaultPalette,
            text: null,
            ignoreColors: []
        };

        return {
            getColor: getColor
        };

        function getColor(options) {
            options || (options = defaultOptions);
            options.palette || (options.palette = defaultPalette);
            options.shades || (options.shades = ['500']);

            var l = usedColors.length,
                color;

            for (var i = 0; i < l; i++) {
                if (options.text && usedColors[i].text === options.text) {
                    return usedColors[i].color;
                }
            }

            color = pickColor(options);
            
            if (options.text) {
                usedColors.push({text: options.text, color: color});
            }

            return color;
        }

        function pickColor(options) {
            var shade = options.shades[getRandomInt(options.shades.length)];
            var color = '';

            for (var key in options.palette) {
                if (options.palette.hasOwnProperty(key) && key === shade) {
                    color = options.palette[key][getRandomInt(options.palette[key].length)];
                }
            }

            return color;
        }

        function getRandomInt(max) {
            return Math.floor(Math.random() * (max));
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('debugService', debugService);

    debugService.$inject = ['$log', 'store', 'errorService'];

    function debugService($log, store, errorService){

        return {
            log: function(message){ log(arguments, 'log'); },
            info: function(message){ log(arguments, 'info'); },
            warn: function(message){ log(arguments, 'warn'); },
            error: errorService.show
        };

        function log(args, method){
            if(store.get('debug')) {
                [].forEach.call(args, function(arg){
                    $log[method](arg);
                });
                return;
            }
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('errorService', errorService);

    errorService.$inject = [];

    function errorService(){

        return {
            show: show
        };

        function show(error){
            return console.error(error);
            // $translate('ERRORS.'+error)
            // .then(function (translation){
            //     if('ERRORS.'+error === translation) {
            //         notifications.showError('ERROR_OCCURRED');
            //     } else {
            //         notifications.showError(translation);
            //     }
            // });
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('SettingsService', SettingsService);

    SettingsService.$inject = ['$q', 'apiService', 'errorService'];

    function SettingsService($q, api, errorService){

        var settings = null;

        return {
            getSettings: getSettings
        };
        
        // Get DB settings from cache or JSON file
        function getSettings() {
            return $q(function(resolve, reject) {
                if(settings) {
                    resolve(settings);
                    return;
                }

                api.getDbSettings()
                .then(function(dbSettings){
                    settings = dbSettings.data;
                    resolve(settings);
                }, function(err){
                    reject(err);
                });
            });
        }

    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('TasksService', TasksService);

    TasksService.$inject = ['apiService', 'errorService'];

    function TasksService(api, errorService){

        var tasks = [
            {name: 'Incoming_Agent', kind: 1},
            {name: 'Messaging_Chat', kind: 7},
            {name: 'Autodial_Agent', kind: 129}
        ];

        return {
            getTasks: getTasks,
            getTaskList: getTaskList
        };
        
        function getTasks() {
            return tasks;
        }

        function getTaskList(id) {
            return api.getTasks({ kind: id });
        }
    }

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('utilsService', utilsService);

    // utilsService.$inject = [];

    function utilsService(){

        return {
            getTotals: getTotals,
            setPercentageValues: setPercentageValues,
            getAbandonmentRate: getAbandonmentRate,
            getSlIndex: getSlIndex,
            getFriendlyKind: getFriendlyKind,
            extendAndSum: extendAndSum,
            sortObjBy: sortObjBy,
            queryToObject: queryToObject,
            periodToRange: periodToRange,
            filterByKey: filterByKey,
            filterUnique: filterUnique
        };

        function getTotals(prev, next){
            var totals = {};
            for(var key in prev){
                if(!isNaN(parseFloat(prev[key])) && !isNaN(parseFloat(next[key]))) {
                    totals[key] = parseFloat(prev[key]) + parseFloat(next[key]);
                }
            }
            return totals;
        }

        function setPercentageValues(data, totals){
            return data.map(function(item) {
                for(var key in item){
                    if(totals.hasOwnProperty(key)) {
                        item[key+'_p'] = (item[key] / totals[key] * 100);
                    }
                }
                return item;
            });
        }

        function getAbandonmentRate(nco, nca){
            return nca * 100 / nco;
        }

        function getSlIndex(array){
            var index = -1;
            array.forEach(function(item, i) {
                if(/^sl/.test(item)) {
                    index = i;
                }
            });
            return index;
        }

        function getFriendlyKind(kind){
            var fkind = '';
            switch (kind) {
                case 1:
                    fkind = 'Incoming_Agent';
                    break;
                case 7:
                    fkind = 'Messaging_Chat';
                    break;
                case 129:
                    fkind = 'Autodial_Agent';
                    break;
                default: fkind = null;
            }

            return fkind;
        }

        function extendAndSum(obj1, obj2, index, array){
            var key, val1, val2;
            for( key in obj2 ) {
                if( obj2.hasOwnProperty( key ) ) {
                    val1 = angular.isUndefined(obj1[key]) ? 0 : obj1[key];
                    val2 = angular.isUndefined(obj2[key]) ? 0 : parseFloat(obj2[key]);
                    if(!isNaN(val2)) {
                        // count sum and find average
                        obj1[key] = angular.isNumber(val1) ? (val1 + val2) : (parseFloat(val1) + val2).toFixed(2);
                        // if(index === array.length-1) obj1[key] = obj1[key] / array.length;
                    } else {
                        if(angular.isArray(obj1[key])){
                            // push to the array of strings
                            obj1[key].push(obj2[key]);
                        } else {
                            // create a new array and add values to it
                            obj1[key] = [].concat(obj1[key], obj2[key]);
                        }
                    }
                }
            }
            return obj1;
        }

        function sortObjBy(array, key, descend){
            var sorted = array.sort(function(a, b){
                if(a[key] > b[key]) return descend ? -1 : 1;
                if(a[key] < b[key]) return descend ? 1 : -1;
                return 0;
            });
            return sorted;
        }

        function queryToObject(data, keys){
            var obj, key;
            return data.map(function(item) {
                obj = {};
                item.forEach(function(value, index) {
                    key = keys[index];
                    obj[key] = value;
                });
                return obj;
            });
        }

        function periodToRange(period){
            var arr = period.split(' ');
            return {
                begin: moment().startOf(arr[1]).toDate(),
                end: moment().endOf(arr[1]).toDate()
            };
            // return {
            //     begin: moment().subtract(parseInt(arr[0], 10), arr[1]).toDate(),
            //     end: moment().endOf('day').toDate()
            // }
        }

        function filterByKey(object, key){
            return object[key];
        }

        function filterUnique(item, index, array){
            if(array.indexOf(item) === -1) return item;
        }

    }

})();
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
(function(){

	'use strict';

	angular
		.module('app')
		.directive('spinner', spinner);

	function spinner(){

		return {
			restrict: 'AE',
			replace: true,
			transclude: true,
			scope: {
				name: '@?',
				group: '@?',
				show: '@?',
				imgSrc: '@?',
				register: '@?',
				onLoaded: '&?',
				onShow: '&?',
				onHide: '&?'
			},
			template: [
				'<div class="spinner-loader animate-show" ng-show="show">',
				'  <img ng-if="imgSrc" ng-src="{{imgSrc}}" />',
				'  <ng-transclude></ng-transclude>',
				'</div>'
			].join(''),
			controller: [ '$scope', 'spinnerService', function($scope, spinnerService) {
				// register should be true by default if not specified.
				if (!$scope.hasOwnProperty('register')) {
					$scope.register = true;
				} else {
					$scope.register = $scope.register.toLowerCase() === 'false' ? false : true;
				}

				// Declare a mini-API to hand off to our service so the service
				// doesn't have a direct reference to this directive's scope.
				var api = {
					name: $scope.name,
					group: $scope.group,
					show: function () {
						$scope.show = true;
					},
					hide: function () {
						$scope.show = false;
					},
					toggle: function () {
						$scope.show = !$scope.show;
					}
				};

				// Register this spinner with the spinner service.
				if ($scope.register === true) {
					console.log('spinner: ', api);
					spinnerService._register(api);
				}

				// If an onShow or onHide expression was provided, register a watcher
				// that will fire the relevant expression when show's value changes.
				if ($scope.onShow || $scope.onHide) {
					$scope.$watch('show', function (show) {
						if (show && $scope.onShow) {
							$scope.onShow({ spinnerService: spinnerService, spinnerApi: api });
						} else if (!show && $scope.onHide) {
							$scope.onHide({ spinnerService: spinnerService, spinnerApi: api });
						}
					});
				}

				// This spinner is good to go. Fire the onLoaded expression.
				if ($scope.onLoaded) {
					$scope.onLoaded({ spinnerService: spinnerService, spinnerApi: api });
				}
			}]
		};

	}

})();
(function(){

    'use strict';

    angular
        .module('app')
        .factory('spinnerService', spinnerService);

    function spinnerService(){

        var spinners = {};
        
        return {
            _register: function (data) {
                if (!data.hasOwnProperty('name')) {
                    console.error(new Error("Spinner must specify a name when registering with the spinner service."));
                }
                if (spinners.hasOwnProperty(data.name)) {
                    console.error(new Error("A spinner with the name '" + data.name + "' has already been registered."));
                }
                spinners[data.name] = data;
            },
            show: function (name) {
                var spinner = spinners[name];
                if (!spinner) {
                    console.error(new Error("No spinner named '" + name + "' is registered."));
                }
                spinner.show();
            },
            hide: function (name) {
                var spinner = spinners[name];
                if (!spinner) {
                    throw new Error("No spinner named '" + name + "' is registered.");
                }
                spinner.hide();
            },
            showAll: function () {
                for (var name in spinners) {
                    spinners[name].show();
                }
            },
            hideAll: function () {
                for (var name in spinners) {
                    spinners[name].hide();
                }
            }
        };

    }

})();
(function(){

	'use strict';

	angular
		.module('app.layout')
		.directive('sideMenu', sideMenu);

	function sideMenu(){

		return {
			restrict: 'AE',
			transclude: true,
			controller: 'SidemenuController',
			controllerAs: 'sidemenuVm',
			templateUrl: 'layout/sidemenu/sidemenu.html'
		};

	}

})();
(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('SidemenuController', SidemenuController);

	SidemenuController.$inject = ['$rootScope', '$mdSidenav'];

	function SidemenuController($rootScope, $mdSidenav) {

		var vm = this;
		vm.isOpen = false;

		$rootScope.$on('$routeChangeSuccess', function() {
			if(vm.isOpen) 
				$mdSidenav('sidenav').toggle();
		});

	}

})();
(function(){

	'use strict';

	angular
		.module('app.layout')
		.controller('TopbarController', TopbarController);

	TopbarController.$inject = ['$rootScope', '$scope', '$mdSidenav'];

	function TopbarController($rootScope, $scope, $mdSidenav) {

		var vm = this;

		vm.toggleSidemenu = function() {
			$mdSidenav('sidenav').toggle();
		};

	}

})();
(function(){

	'use strict';

	angular
		.module('app.layout')
		.directive('topBar', topBar);

	function topBar(){

		return {
			restrict: 'AE',
			transclude: true,
			controller: 'TopbarController',
			controllerAs: 'topbarVm',
			templateUrl: 'layout/topbar/topbar.html',
		};

	}

})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFwcC5jb25maWcuanMiLCJhcHAuY29yZS5qcyIsImFwcC5jcnIuanMiLCJhcHAuZGFzaGJvYXJkLmpzIiwiYXBwLmZjci5qcyIsImFwcC5sYXlvdXQuanMiLCJhcHAucm91dGVzLmpzIiwiY3JyL2Nyci1zZXR0aW5ncy5jb250cm9sbGVyLmpzIiwiY3JyL2Nyci5jb250cm9sbGVyLmpzIiwiY3JyL2Nyci5yb3V0ZS5qcyIsImRhc2hib2FyZC9kYXNoYm9hcmQtZXhwb3J0LmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvZGFzaGJvYXJkLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvZGFzaGJvYXJkLmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvZGFzaGJvYXJkLnJvdXRlLmpzIiwiZGFzaGJvYXJkL2tpbmQtc2V0dGluZ3MuY29udHJvbGxlci5qcyIsImRhc2hib2FyZC9wcm9jZXNzZXMtZXhwb3J0LmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvc3RhdC1jYXJkLmRpcmVjdGl2ZS5qcyIsImZjci9mY3Itc2V0dGluZ3MuY29udHJvbGxlci5qcyIsImZjci9mY3IuY29udHJvbGxlci5qcyIsImZjci9mY3Iucm91dGUuanMiLCJmaWx0ZXJzL2ZpbHRlcnMuanMiLCJsYXlvdXQvbGF5b3V0LmNvbnRyb2xsZXIuanMiLCJzZXJ2aWNlcy9hcGkuanMiLCJzZXJ2aWNlcy9jaGFydC5qcyIsInNlcnZpY2VzL2NvbG91ci1nZW4uanMiLCJzZXJ2aWNlcy9kZWJ1Zy5qcyIsInNlcnZpY2VzL2Vycm9yLmpzIiwic2VydmljZXMvc2V0dGluZ3MuanMiLCJzZXJ2aWNlcy90YXNrcy5qcyIsInNlcnZpY2VzL3V0aWxzLmpzIiwiY29tcG9uZW50cy9kYXRlcGlja2VyL3BpY2tlci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvX19zcGlubmVyLmNvbnRyb2xsZXIuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5zZXJ2aWNlLmpzIiwibGF5b3V0L3NpZGVtZW51L3NpZGUtbWVudS5kaXJlY3RpdmUuanMiLCJsYXlvdXQvc2lkZW1lbnUvc2lkZW1lbnUuY29udHJvbGxlci5qcyIsImxheW91dC90b3BiYXIvdG9wLWJhci5jb250cm9sbGVyLmpzIiwibGF5b3V0L3RvcGJhci90b3AtYmFyLmRpcmVjdGl2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNQQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDekxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4dEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJhbmd1bGFyLm1vZHVsZSgnYXBwJywgW1xuXHQnYXBwLmNvcmUnLFxuXHQnYXBwLmNvbmZpZycsXG5cdCdhcHAucm91dGVzJyxcblx0J2FwcC5sYXlvdXQnLFxuXHQnYXBwLmNycicsXG5cdCdhcHAuZmNyJyxcblx0J2FwcC5kYXNoYm9hcmQnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNvbmZpZycsIFtcblx0J2FwcC5jb3JlJ1xuXSlcbi5jb25zdGFudCgnYXBwQ29uZmlnJywge1xuXHRzZXJ2ZXI6IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCArICcvLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdFxufSlcbi5jb25maWcoWyckY29tcGlsZVByb3ZpZGVyJywgZnVuY3Rpb24gKCRjb21waWxlUHJvdmlkZXIpIHtcbiAgJGNvbXBpbGVQcm92aWRlci5kZWJ1Z0luZm9FbmFibGVkKGZhbHNlKTtcbn1dKVxuLmNvbmZpZyhbJ0NoYXJ0SnNQcm92aWRlcicsZnVuY3Rpb24oQ2hhcnRKc1Byb3ZpZGVyKSB7XG5cdENoYXJ0SnNQcm92aWRlci5zZXRPcHRpb25zKHtcblx0XHRsZWdlbmRUZW1wbGF0ZSA6IFwiPHVsIGNsYXNzPVxcXCJjdXN0b20tbGVnZW5kIDwlPW5hbWUudG9Mb3dlckNhc2UoKSU+LWxlZ2VuZFxcXCI+PCUgZm9yICh2YXIgaT0wOyBpPHNlZ21lbnRzLmxlbmd0aDsgaSsrKXslPjxsaT48c3BhbiBzdHlsZT1cXFwiYmFja2dyb3VuZC1jb2xvcjo8JT1zZWdtZW50c1tpXS5maWxsQ29sb3IlPlxcXCI+PC9zcGFuPjwlaWYoc2VnbWVudHNbaV0ubGFiZWwpeyU+PCU9c2VnbWVudHNbaV0ubGFiZWwlPjwlfSU+PC9saT48JX0lPjwvdWw+XCJcblx0fSk7XG59XSk7XG5cbi8vIC5jb25maWcoWyckbWRUaGVtaW5nUHJvdmlkZXInLGZ1bmN0aW9uKCRtZFRoZW1pbmdQcm92aWRlcikge1xuLy8gXHQkbWRUaGVtaW5nUHJvdmlkZXIudGhlbWUoJ2N5YW4nKTtcbi8vIH1dKVxuLy8gLmNvbmZpZyhbJyR0cmFuc2xhdGVQcm92aWRlcicsIGZ1bmN0aW9uKCR0cmFuc2xhdGVQcm92aWRlcikge1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU3RhdGljRmlsZXNMb2FkZXIoe1xuLy8gXHRcdHByZWZpeDogJy90cmFuc2xhdGlvbnMvbG9jYWxlLScsXG4vLyBcdFx0c3VmZml4OiAnLmpzb24nXG4vLyBcdH0pO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIucHJlZmVycmVkTGFuZ3VhZ2UoJ2VuJyk7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci5mYWxsYmFja0xhbmd1YWdlKCdlbicpO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU3RvcmFnZSgnc3RvcmFnZScpO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU2FuaXRpemVWYWx1ZVN0cmF0ZWd5KCdzYW5pdGl6ZVBhcmFtZXRlcnMnKTtcbi8vIFx0Ly8gJHRyYW5zbGF0ZVByb3ZpZGVyLnVzZVNhbml0aXplVmFsdWVTdHJhdGVneSgnZXNjYXBlJyk7XG4vLyB9XSlcbi8vIC5jb25maWcoWyd0bWhEeW5hbWljTG9jYWxlUHJvdmlkZXInLCBmdW5jdGlvbih0bWhEeW5hbWljTG9jYWxlUHJvdmlkZXIpIHtcbi8vIFx0dG1oRHluYW1pY0xvY2FsZVByb3ZpZGVyLmxvY2FsZUxvY2F0aW9uUGF0dGVybignLi9qcy9saWIvaTE4bi9hbmd1bGFyLWxvY2FsZV97e2xvY2FsZX19LmpzJyk7XG4vLyB9XSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5jb3JlJywgW1xuXHQnbmdBbmltYXRlJyxcblx0J25nTWF0ZXJpYWwnLFxuXHQnYW5ndWxhck1vbWVudCcsXG5cdCdhbmd1bGFyLXN0b3JhZ2UnLFxuXHQnbWQuZGF0YS50YWJsZScsXG5cdCdjaGFydC5qcydcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuY3JyJywgW1xuXHQnYXBwLmNvcmUnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmRhc2hib2FyZCcsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5mY3InLCBbXG5cdCdhcHAuY29yZSdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAubGF5b3V0JywgW1xuXHQnYXBwLmNvcmUnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLnJvdXRlcycsIFtcblx0J25nUm91dGUnXG5dKVxuLmNvbmZpZyhbJyRyb3V0ZVByb3ZpZGVyJywgZnVuY3Rpb24oJHJvdXRlUHJvdmlkZXIpe1xuXG5cdCRyb3V0ZVByb3ZpZGVyLlxuXHRcdG90aGVyd2lzZSh7XG5cdFx0XHRyZWRpcmVjdFRvOiAnL2Rhc2hib2FyZCdcblx0XHR9KTtcbn1dKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5jcnInKVxuXHRcdC5jb250cm9sbGVyKCdDcnJTZXR0aW5nc0NvbnRyb2xsZXInLCBDcnJTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdENyclNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJG1kRGlhbG9nJywgJ3Rhc2tzJywgJ3NlbGVjdGVkVGFza3MnLCAnZGVidWdTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gQ3JyU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCB0YXNrcywgc2VsZWN0ZWRUYXNrcywgZGVidWcpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS50YXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IFtdLmNvbmNhdChzZWxlY3RlZFRhc2tzKTtcblx0XHR2bS5zZWxlY3RBbGxUYXNrcyA9IHNlbGVjdEFsbFRhc2tzO1xuXHRcdHZtLmFsbFRhc2tzU2VsZWN0ZWQgPSAodGFza3MubGVuZ3RoID09PSBzZWxlY3RlZFRhc2tzLmxlbmd0aCk7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5pbmRleCA9IGluZGV4O1xuXHRcdHZtLmV4aXN0cyA9IGV4aXN0cztcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdHJldHVybiB2bS5zZWxlY3RlZFRhc2tzLmxlbmd0aDtcblx0XHR9LCBmdW5jdGlvbih2YWwpe1xuXHRcdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLnNlbGVjdGVkVGFza3MubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHRkZWJ1Zy5sb2coJ3Rhc2tzbSBzZWxlY3RlZFRhc2tzOiAnLCB2bS50YXNrcywgdm0uc2VsZWN0ZWRUYXNrcyk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRzZWxlY3RlZFRhc2tzOiB2bS5zZWxlY3RlZFRhc2tzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0uc2VsZWN0ZWRUYXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLnNlbGVjdGVkVGFza3MgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0b2dnbGUoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IGluZGV4KGl0ZW0sIGxpc3QpO1xuXHRcdFx0aWYgKGlkeCAhPT0gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0gPT0gaXRlbSkgaWR4ID0gaW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBpZHg7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmNycicpXG5cdFx0LmNvbnRyb2xsZXIoJ0NyckNvbnRyb2xsZXInLCBDcnJDb250cm9sbGVyKTtcblxuXHRDcnJDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJG1kRGlhbG9nJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ1Rhc2tzU2VydmljZScsICd1dGlsc1NlcnZpY2UnLCAnZGVidWdTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2Vycm9yU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIENyckNvbnRyb2xsZXIoJHJvb3RTY29wZSwgJG1kRGlhbG9nLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgVGFza3NTZXJ2aWNlLCB1dGlscywgZGVidWcsIHNwaW5uZXJTZXJ2aWNlLCBlcnJvclNlcnZpY2UpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHRPcHRpb25zID0ge1xuXHRcdFx0cGVyaW9kOiAnMSBtb250aCdcblx0XHR9O1xuXHRcdHZhciBwZXJmU3RhdCA9IFtdO1xuXHRcdHZhciBhZ2VudFN0YXQgPSBbXTtcblx0XHR2YXIgYWdlbnRzRmNyID0ge307XG5cblx0XHR2bS5zZXR0aW5ncyA9IHt9O1xuXHRcdHZtLnRhc2tzID0gW107XG5cdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdHZtLnN0YXQgPSBbXTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdE9wdGlvbnMucGVyaW9kKS5iZWdpbjtcblx0XHR2bS5lbmQgPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRPcHRpb25zLnBlcmlvZCkuZW5kO1xuXHRcdHZtLmdldENhbGxSZXNvbHV0aW9uID0gZ2V0Q2FsbFJlc29sdXRpb247XG5cdFx0dm0ub3BlblNldHRpbmdzID0gb3BlblNldHRpbmdzO1xuXHRcdHZtLnRhYmxlU29ydCA9ICctcGVyZic7XG5cblx0XHRpbml0KCk7XG5cdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKSB7XG5cdFx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdFx0cmV0dXJuIFRhc2tzU2VydmljZS5nZXRUYXNrTGlzdCgxKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ3Rhc2tzOiAnLCB0YXNrcy5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdHZtLnRhc2tzID0gdGFza3MuZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSB0YXNrcy5kYXRhLnJlc3VsdDtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihnZXRDYWxsUmVzb2x1dGlvbilcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlblNldHRpbmdzKCRldmVudCkge1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Nyci9jcnItc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdDcnJTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdjcnJTZXR0c1ZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdHRhc2tzOiB2bS50YXNrcyxcblx0XHRcdFx0XHRzZWxlY3RlZFRhc2tzOiB2bS5zZWxlY3RlZFRhc2tzXG5cdFx0XHRcdH1cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSByZXN1bHQuc2VsZWN0ZWRUYXNrcztcblx0XHRcdFx0Z2V0Q2FsbFJlc29sdXRpb24oKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhbGxSZXNvbHV0aW9uKCkge1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcztcblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY3JyLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gZ2V0QWdlbnRzU3RhdCh0YWJsZXMsIHZtLmJlZ2luLnZhbHVlT2YoKSwgdm0uZW5kLnZhbHVlT2YoKSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKGFzdGF0KSB7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0QWdlbnRzU3RhdCBkYXRhOiAnLCBhc3RhdC5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdGFnZW50U3RhdCA9IGFzdGF0LmRhdGEucmVzdWx0XG5cdFx0XHRcdHJldHVybiBnZXRQZXJmU3RhdCh0YWJsZXMsIHZtLmJlZ2luLnZhbHVlT2YoKSwgdm0uZW5kLnZhbHVlT2YoKSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocHN0YXQpIHtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRQZXJmU3RhdCBkYXRhOiAnLCBwc3RhdC5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdHBlcmZTdGF0ID0gcHN0YXQuZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLnN0YXQgPSBhbmd1bGFyLm1lcmdlKFtdLCBhZ2VudFN0YXQsIHBlcmZTdGF0KTtcblx0XHRcdFx0dm0uc3RhdC5tYXAoYWRkUGVyZlZhbHVlKTtcblxuXHRcdFx0XHRyZXR1cm4gYXBpLmdldEZDUlN0YXRpc3RpY3Moe1xuXHRcdFx0XHRcdHRhc2s6IHZtLnRhc2tzWzBdLFxuXHRcdFx0XHRcdHRhYmxlOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdFx0aW50ZXJ2YWw6IDM2MDAqMjQqMTAwMCxcblx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLCBcblx0XHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZmNyKSB7XG5cdFx0XHRcdGFnZW50c0ZjciA9IGFycmF5VG9PYmplY3RBbmRTdW0oZmNyLmRhdGEucmVzdWx0LCAnYWdlbnQnKTtcblx0XHRcdFx0ZGVidWcubG9nKCdmY3I6ICcsIGFnZW50c0Zjcik7XG5cdFx0XHRcdHZtLnN0YXQubWFwKGFkZEZjclZhbHVlKTtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY3JyLWxvYWRlcicpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QWdlbnRzU3RhdCh0YWJsZXMsIGJlZ2luLCBlbmQpe1xuXHRcdFx0dmFyIGRhdGEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudCgqKScsJ3N1bShjb25uZWN0VGltZSknLCdhdmcoY29ubmVjdFRpbWUpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJyt2bS50YXNrcy5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0sXG5cdFx0XHRcdGJlZ2luOiBiZWdpbixcblx0XHRcdFx0ZW5kOiBlbmQsXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFBlcmZTdGF0KHRhYmxlcywgYmVnaW4sIGVuZCl7XG5cdFx0XHR2YXIgZGF0YSxcblx0XHRcdG1ldHJpY3MgPSBbJ2NvdW50KGNhbGxyZXN1bHQpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJyt2bS50YXNrcy5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0uam9pbignLicpKyc9MScsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0LCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0sXG5cdFx0XHRcdGJlZ2luOiBiZWdpbixcblx0XHRcdFx0ZW5kOiBlbmQsXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFkZFBlcmZWYWx1ZShpdGVtKSB7XG5cdFx0XHRpdGVtLnBlcmYgPSBpdGVtWydjb3VudChjYWxscmVzdWx0KSddIC8gaXRlbVsnY291bnQoKiknXSAqIDEwMDtcblx0XHRcdHJldHVybiBpdGVtO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFkZEZjclZhbHVlKGl0ZW0pIHtcblx0XHRcdHZhciBjdXJyRmNyID0gYWdlbnRzRmNyW2l0ZW0ub3BlcmF0b3JdO1xuXHRcdFx0aXRlbS5mY3IgPSBjdXJyRmNyICE9PSB1bmRlZmluZWQgPyAoY3VyckZjci5mY3IgLyBjdXJyRmNyLnRvdGFsICogMTAwKSA6IG51bGw7XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhcnJheVRvT2JqZWN0KGFycmF5LCBwcm9wTmFtZSkge1xuXHRcdFx0cmV0dXJuIGFycmF5LnJlZHVjZShmdW5jdGlvbihwcmV2LCBuZXh0KSB7XG5cdFx0XHRcdGlmKG5leHQuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG5cdFx0XHRcdFx0cHJldltuZXh0W3Byb3BOYW1lXV0gPSBuZXh0O1xuXHRcdFx0XHRcdHJldHVybiBwcmV2O1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB7fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXJyYXlUb09iamVjdEFuZFN1bShhcnJheSwgcHJvcE5hbWUpIHtcblx0XHRcdHJldHVybiBhcnJheS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgbmV4dCkge1xuXHRcdFx0XHRpZihuZXh0Lmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuXHRcdFx0XHRcdHByZXZbbmV4dFtwcm9wTmFtZV1dID0gcHJldltuZXh0W3Byb3BOYW1lXV0gPyBzdW1PYmplY3RzKG5leHQsIHByZXZbbmV4dFtwcm9wTmFtZV1dKSA6IG5leHQ7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHt9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdW1PYmplY3RzKCkge1xuXHRcdFx0dmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cdFx0XHR2YXIgc3VtID0ge307XG5cblx0XHRcdHJldHVybiBhcmdzLnJlZHVjZShmdW5jdGlvbih0b3RhbCwgbmV4dCkge1xuXG5cdFx0XHRcdE9iamVjdC5rZXlzKG5leHQpXG5cdFx0XHRcdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdGlmKHR5cGVvZiBuZXh0W2tleV0gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHR0b3RhbFtrZXldID0gdG90YWxba2V5XSA/IHRvdGFsW2tleV0gKyBuZXh0W2tleV0gOiBuZXh0W2tleV07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvdGFsW2tleV0gPSBuZXh0W2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gdG90YWw7XG5cblx0XHRcdH0sIHN1bSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNycicpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2NycicsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnY3JyL2Nyci5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdDcnJDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2NyclZtJ1xuXHRcdH0pO1xufV0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ0Rhc2hFeHBvcnRDb250cm9sbGVyJywgRGFzaEV4cG9ydENvbnRyb2xsZXIpO1xuXG5cdERhc2hFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRtZERpYWxvZycsICdraW5kcycsICd0YWJsZXMnLCAnZGF0YScsICdiZWdpbicsICdlbmQnLCAnc3RhdCcsICdwcmV2c3RhdCcsICdjYXRzdGF0J107XG5cblx0ZnVuY3Rpb24gRGFzaEV4cG9ydENvbnRyb2xsZXIoJG1kRGlhbG9nLCBraW5kcywgdGFibGVzLCBkYXRhLCBiZWdpbiwgZW5kLCBzdGF0LCBwcmV2c3RhdCwgY2F0c3RhdCkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLmtpbmRzID0ga2luZHM7XG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLnN0YXQgPSBzdGF0O1xuXHRcdHZtLnByZXZzdGF0ID0gcHJldnN0YXQ7XG5cdFx0dm0uY2F0c3RhdCA9IGNhdHN0YXQ7XG5cdFx0dm0uY2xvc2UgPSBmdW5jdGlvbigpe1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoKTtcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5jb250cm9sbGVyKCdEYXNoU2V0dGluZ3NDb250cm9sbGVyJywgRGFzaFNldHRpbmdzQ29udHJvbGxlcik7XG5cblx0RGFzaFNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckbWREaWFsb2cnLCAnb3B0aW9ucyddO1xuXG5cdGZ1bmN0aW9uIERhc2hTZXR0aW5nc0NvbnRyb2xsZXIoJG1kRGlhbG9nLCBvcHRpb25zKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0ub3B0aW9ucyA9IGFuZ3VsYXIuY29weShvcHRpb25zLCB7fSk7XG5cdFx0dm0ucGVyaW9kcyA9IFsnMSBob3VyJywgJzEgZGF5JywgJzEgd2VlaycsICcxIG1vbnRoJywgJzYgbW9udGhzJywgJzEgeWVhciddO1xuXHRcdHZtLmludGVydmFscyA9IFsnMSBtaW51dGVzJywgJzUgbWludXRlcycsICcxMCBtaW51dGVzJywgJzIwIG1pbnV0ZXMnLCAnMzAgbWludXRlcycsICcxIGhvdXInXTtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmluZGV4ID0gaW5kZXg7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRvcHRpb25zOiB2bS5vcHRpb25zXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gdm0uaW5kZXgoaXRlbSwgbGlzdCk7XG5cdFx0XHRpZiAoaWR4ID4gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0ua2luZCA9PSBpdGVtLmtpbmQpIGlkeCA9IGluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaWR4O1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignRGFzaENvbnRyb2xsZXInLCBEYXNoQ29udHJvbGxlcik7XG5cblx0RGFzaENvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckc2NvcGUnLCAnJHRpbWVvdXQnLCAnJHEnLCAnJG1kTWVkaWEnLCAnJG1kQm90dG9tU2hlZXQnLCAnJG1kRGlhbG9nJywgJyRtZFRvYXN0JywgJ3N0b3JlJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2NoYXJ0U2VydmljZScsICdkZWJ1Z1NlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJywgJ3V0aWxzU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIERhc2hDb250cm9sbGVyKCRyb290U2NvcGUsICRzY29wZSwgJHRpbWVvdXQsICRxLCAkbWRNZWRpYSwgJG1kQm90dG9tU2hlZXQsICRtZERpYWxvZywgJG1kVG9hc3QsIHN0b3JlLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgc3Bpbm5lclNlcnZpY2UsIGNoYXJ0U2VydmljZSwgZGVidWcsIGVycm9yU2VydmljZSwgdXRpbHMpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHREYXRhID0ge1xuXHRcdFx0SW5jb21pbmdfQWdlbnQ6IHtcblx0XHRcdFx0a2luZDogMSxcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDIwLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYScsICdjYXInLCAnYXNhJ11cblx0XHRcdH0sXG5cdFx0XHRNZXNzYWdpbmdfQ2hhdDoge1xuXHRcdFx0XHRraW5kOiA3LFxuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRzbDogNSxcblx0XHRcdFx0bWV0cmljczogWydhaHQnLCAnYXR0JywgJ25jbycsICduY2EnLCAnY2FyJ11cblx0XHRcdH0sXG5cdFx0XHRBdXRvZGlhbF9BZ2VudDoge1xuXHRcdFx0XHRraW5kOiAxMjksXG5cdFx0XHRcdHRhc2tzOiBbXSxcblx0XHRcdFx0bGlzdDogW10sXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJ11cblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0czoge1xuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRzbDogMjAsXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJywgJ2NhciddXG5cdFx0XHR9XG5cdFx0XHRcdFxuXHRcdH0sXG5cdFx0ZGVmYXVsdE9wdGlvbnMgPSB7XG5cdFx0XHRhdXRvdXBkYXRlOiBmYWxzZSxcblx0XHRcdHVwZGF0ZUV2ZXJ5OiAnMSBtaW51dGVzJyxcblx0XHRcdGtpbmRzOiBbe25hbWU6ICdJbmNvbWluZ19BZ2VudCcsIGtpbmQ6IDF9XSxcblx0XHRcdGtpbmRzTGlzdDogW3tuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfSwge25hbWU6ICdNZXNzYWdpbmdfQ2hhdCcsIGtpbmQ6IDd9LCB7bmFtZTogJ0F1dG9kaWFsX0FnZW50Jywga2luZDogMTI5fV0sXG5cdFx0XHQvLyBraW5kczogWzEsIDcsIDEyOV0sXG5cdFx0XHRzbDogWzUsIDEwLCAxNSwgMjAsIDI1LCAzMCwgMzUsIDQwXSxcblx0XHRcdGRiOiB7fSxcblx0XHRcdHRhYmxlczogW10sXG5cdFx0XHRwZXJpb2Q6ICcxIGRheScsXG5cdFx0XHRjYXRDb2xvdXJzOiBbXSxcblx0XHRcdGNhdG9yZGVyOiAnY2F0ZGVzYycgLy8gY2hhbmdlZCBkdXJpbmcgdGhlIGRhc2hib2FyZCBpbml0aWF0aW9uIHRvIHRoZSB2YWx1ZSBmcm9tIHRoZSBjb25maWcgZmlsZVxuXHRcdH0sXG5cdFx0dXBkYXRlVGltZW91dCA9IG51bGw7XG5cblx0XHR2bS5vcHRpb25zID0gZ2V0RGVmYXVsdE9wdGlvbnMoKTtcblx0XHR2bS5kYXRhID0gZ2V0RGVmYXVsdERhdGEoKTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2Uodm0ub3B0aW9ucy5wZXJpb2QpLmJlZ2luO1xuXHRcdHZtLmVuZCA9IHV0aWxzLnBlcmlvZFRvUmFuZ2Uodm0ub3B0aW9ucy5wZXJpb2QpLmVuZDtcblx0XHR2bS5zdGF0ID0ge307XG5cdFx0dm0ucHJldnN0YXQgPSB7fTtcblx0XHR2bS5jYXRzdGF0ID0gW107XG5cdFx0dm0uZ2xvYmFsQ3IgPSB7fTtcblx0XHR2bS5nbG9iYWxGY3IgPSB7fTtcblx0XHR2bS5wcmV2R2xvYmFsRmNyID0ge307XG5cdFx0Ly8gdm0uY2F0VG90YWxzID0ge307XG5cdFx0Ly8gdm0uc3ViY2F0VG90YWxzID0ge307XG5cdFx0dm0uc2VsZWN0ZWRDYXQgPSBudWxsO1xuXHRcdHZtLnN1YkNhdHNTdGF0ID0gW107XG5cdFx0dm0uY2F0Y2hhcnREYXRhID0ge307XG5cdFx0dm0uY2F0Y2hhcnRMYWJlbCA9ICduY2EnO1xuXHRcdHZtLmNoYXJ0T3B0aW9ucyA9IHtcblx0XHRcdGxheW91dDoge1xuXHRcdFx0XHRwYWRkaW5nOiB7XG5cdFx0XHRcdFx0bGVmdDogNDAsXG5cdFx0XHRcdFx0cmlnaHQ6IDQwXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHZtLmNhdE1ldHJpY3MgPSBbeyBpbmRleDogJ25jYScsIG5hbWU6ICdOdW1iZXIgb2YgY2FsbHMgYW5zd2VyZWQnIH0sIHsgaW5kZXg6ICdhaHQnLCBuYW1lOiAnQXZlcmFnZSBoYW5kbGUgdGltZScgfSwgeyBpbmRleDogJ2F0dCcsIG5hbWU6ICdBdmVyYWdlIHRhbGsgdGltZScgfV07XG5cdFx0dm0udG90YWxCeUNhdGVnb3J5ID0ge307XG5cdFx0dm0udXNlckZ1bGxTY3JlZW4gPSAkbWRNZWRpYSgneHMnKTtcblx0XHR2bS5hYlJhdGUgPSB1dGlscy5nZXRBYmFuZG9ubWVudFJhdGU7XG5cdFx0Ly8gdm0uZ2V0RnJpZW5kbHlLaW5kID0gZ2V0RnJpZW5kbHlLaW5kO1xuXHRcdHZtLm9wZW5EYXNoU2V0dGluZ3MgPSBvcGVuRGFzaFNldHRpbmdzO1xuXHRcdHZtLm9uQ2F0U2VsZWN0ID0gb25DYXRTZWxlY3Q7XG5cdFx0dm0ub25TdWJDYXRTZWxlY3QgPSBvblN1YkNhdFNlbGVjdDtcblx0XHR2bS5nZXRTdGF0ID0gZ2V0U3RhdDtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0uZXhwb3J0RGFzaCA9IGV4cG9ydERhc2g7XG5cblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZtLm9wdGlvbnM7XG5cdFx0fSwgZnVuY3Rpb24obmV3VmFsdWUsIHByZXZWYWx1ZSkge1xuXHRcdFx0ZGVidWcubG9nKCdPcHRpb25zIGNoYW5nZWQhISEnLCBuZXdWYWx1ZSk7XG5cdFx0XHRzdG9yZS5zZXQoJ29wdGlvbnMnLCBuZXdWYWx1ZSk7XG5cdFx0fSk7XG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB2bS5jYXRjaGFydExhYmVsO1xuXHRcdH0sIGZ1bmN0aW9uKG5ld1ZhbHVlLCBwcmV2VmFsdWUpIHtcblx0XHRcdGlmKHZtLnNlbGVjdGVkQ2F0KVxuXHRcdFx0XHR2bS5jYXRjaGFydERhdGEgPSBjaGFydFNlcnZpY2Uuc2V0Q2hhcnREYXRhKHZtLnN1YkNhdHNTdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHZtLmNhdGNoYXJ0TGFiZWwpO1xuXHRcdFx0ZWxzZVxuXHRcdFx0XHRpZih2bS5vcHRpb25zLmRiLnRhYmxlcykgdm0uY2F0Y2hhcnREYXRhID0gY2hhcnRTZXJ2aWNlLnNldENoYXJ0RGF0YSh2bS5jYXRzdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHZtLmNhdGNoYXJ0TGFiZWwpO1xuXHRcdH0pO1xuXHRcdCRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XG5cdFx0XHQkdGltZW91dC5jYW5jZWwodXBkYXRlVGltZW91dCk7XG5cdFx0XHR1cGRhdGVUaW1lb3V0ID0gbnVsbDtcblx0XHR9KTtcblxuXHRcdC8vIEdldCBEQiBzZXR0aW5ncyBhbmQgaW5pdCB0aGUgRGFzaGJvYXJkXG5cdFx0U2V0dGluZ3NTZXJ2aWNlLmdldFNldHRpbmdzKClcblx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdGRlYnVnLmxvZygnREIgc2V0dGluZ3MnLCBkYlNldHRpbmdzKTtcblx0XHRcdHZhciB0YWJsZXMgPSBkYlNldHRpbmdzLnRhYmxlcyxcblx0XHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0XHRkYjogZGJTZXR0aW5ncyxcblx0XHRcdFx0XHR0YWJsZXNMaXN0OiBbXSxcblx0XHRcdFx0XHRjYWxsc3RhYmxlOiB0YWJsZXMuY2FsbHMgPyB0YWJsZXMuY2FsbHMgOiBudWxsLFxuXHRcdFx0XHRcdGNhdHRhYmxlOiB0YWJsZXMuY2F0ZWdvcmllcyA/IHRhYmxlcy5jYXRlZ29yaWVzIDogbnVsbCxcblx0XHRcdFx0XHRzdWJjYXR0YWJsZTogdGFibGVzLnN1YmNhdGVnb3JpZXMgPyB0YWJsZXMuc3ViY2F0ZWdvcmllcyA6IG51bGwsXG5cdFx0XHRcdFx0Y2F0b3JkZXI6IHRhYmxlcy5jYXRlZ29yaWVzID8gdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiA6IG51bGxcblx0XHRcdFx0fTtcblxuXHRcdFx0YW5ndWxhci5leHRlbmQodm0ub3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0XHRhbmd1bGFyLmZvckVhY2godGFibGVzLCBmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0aWYoaXRlbS5uYW1lKSB2bS5vcHRpb25zLnRhYmxlc0xpc3QucHVzaChpdGVtLm5hbWUpO1xuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGluaXQoKTtcblx0XHRcdGF1dG9VcGRhdGUoKTtcblx0XHR9KTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKXtcblx0XHRcdGlmKCF2bS5vcHRpb25zLmtpbmRzLmxlbmd0aCkgcmV0dXJuIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ21haW4tbG9hZGVyJyk7XG5cblx0XHRcdHZtLm9wdGlvbnMua2luZHMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0YXBpLmdldFRhc2tzKHsga2luZDogaXRlbS5raW5kIH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiBzZXRUYXNrcyhyZXN1bHQsIGl0ZW0pO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRcdHJldHVybiBnZXRTdGF0RGF0YSh2bS5kYXRhW2l0ZW0ubmFtZV0ubGlzdCB8fCB0YXNrcywgaXRlbSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlICYmIHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmNhbGxyZXN1bHQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBnZXRDYWxsUmVzb2x1dGlvblN0YXQoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICRxLmRlZmVyKCkucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlICYmIHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luKSB7XG5cdFx0XHRcdFx0XHRkZWJ1Zy5sb2coJ3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luOiAnLCB2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5sb2dpbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0TG9naW5zUmF0aW8oKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICRxLmRlZmVyKCkucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYXR0YWJsZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhdGVnb3JpZXNTdGF0KCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAkcS5kZWZlcigpLnJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGdldEdsb2JhbEZyYylcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZihpbmRleCA9PT0gYXJyYXkubGVuZ3RoLTEpIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ21haW4tbG9hZGVyJyk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhdXRvVXBkYXRlKCl7XG5cdFx0XHR2YXIgZHVyID0gdm0ub3B0aW9ucy51cGRhdGVFdmVyeS5zcGxpdCgnICcpO1xuXHRcdFx0dXBkYXRlVGltZW91dCA9ICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZih2bS5vcHRpb25zLmF1dG91cGRhdGUpIHZtLmdldFN0YXQoKTtcblx0XHRcdFx0YXV0b1VwZGF0ZSgpO1xuXHRcdFx0fSwgbW9tZW50LmR1cmF0aW9uKHBhcnNlSW50KGR1clswXSwgMTApLCBkdXJbMV0pLl9taWxsaXNlY29uZHMpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXQoa2luZHMpIHtcblx0XHRcdHZhciBraW5kc0xpc3QgPSBraW5kcyB8fCB2bS5vcHRpb25zLmtpbmRzO1xuXHRcdFx0a2luZHNMaXN0LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5zaG93KGl0ZW0ubmFtZSsnLWxvYWRlcicpO1xuXHRcdFx0XHRnZXRTdGF0RGF0YSh2bS5kYXRhW2l0ZW0ubmFtZV0ubGlzdCwgaXRlbSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUgJiYgdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhbGxSZXNvbHV0aW9uU3RhdCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJHEuZGVmZXIoKS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUgJiYgdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMubG9naW4pIHtcblx0XHRcdFx0XHRcdGRlYnVnLmxvZygndm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMubG9naW46ICcsIHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luKTtcblx0XHRcdFx0XHRcdHJldHVybiBnZXRMb2dpbnNSYXRpbygpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJHEuZGVmZXIoKS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihnZXRHbG9iYWxGcmMpXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7IHNwaW5uZXJTZXJ2aWNlLmhpZGUoaXRlbS5uYW1lKyctbG9hZGVyJyk7IH0pXG5cdFx0XHRcdC5jYXRjaChmdW5jdGlvbigpeyBzcGlubmVyU2VydmljZS5oaWRlKGl0ZW0ubmFtZSsnLWxvYWRlcicpOyB9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZih2bS5vcHRpb25zLmNhdHRhYmxlKSBnZXRDYXRlZ29yaWVzU3RhdCgpO1xuXG5cdFx0XHQkbWRUb2FzdC5zaG93KFxuXHRcdFx0XHQkbWRUb2FzdC5zaW1wbGUoKVxuXHRcdFx0XHRcdC50ZXh0Q29udGVudCgnVXBkYXRpbmcgaW5kZXhlcycpXG5cdFx0XHRcdFx0LnBvc2l0aW9uKCd0b3AgcmlnaHQnKVxuXHRcdFx0XHRcdC5oaWRlRGVsYXkoMjAwMClcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlbkRhc2hTZXR0aW5ncygkZXZlbnQpIHtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQvZGFzaC1zZXR0aW5ncy5odG1sJyxcblx0XHRcdFx0Y29udHJvbGxlcjogJ0Rhc2hTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoU2V0Vm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0b3B0aW9uczogdm0ub3B0aW9uc1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnbWFpbi1sb2FkZXInKTtcblx0XHRcdFx0dm0ub3B0aW9ucyA9IHJlc3VsdC5vcHRpb25zO1xuXHRcdFx0XHRpbml0KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvbkNhdFNlbGVjdChjYXQsIGluZGV4KSB7XG5cdFx0XHRpZih2bS5zZWxlY3RlZENhdCAmJiAoIWNhdCB8fCBjYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldID09PSB2bS5zZWxlY3RlZENhdFt2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5jYXRlZ29yeV0pKSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0ID0gbnVsbDtcblx0XHRcdFx0dm0uc3ViQ2F0c1N0YXQgPSBbXTtcblx0XHRcdFx0dm0uY2F0Y2hhcnREYXRhID0gY2hhcnRTZXJ2aWNlLnNldENoYXJ0RGF0YSh2bS5jYXRzdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHZtLmNhdGNoYXJ0TGFiZWwpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHZtLnNlbGVjdGVkQ2F0ID0gY2F0O1xuXG5cdFx0XHRnZXRTdWJDYXRlZ29yaWVzU3RhdChjYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGEsIHRvdGFscyA9IHt9O1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0Ly8gaWYoIWRhdGEucmVzdWx0Lmxlbmd0aCkgcmV0dXJuO1xuXG5cdFx0XHRcdC8vIHZtLnN1YmNhdFRvdGFscyA9IGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXHRcdFx0XHR2bS5zdWJDYXRzU3RhdCA9IGRhdGEucmVzdWx0Lmxlbmd0aCA/IHNldENhdHNTdGF0KGRhdGEucmVzdWx0LCBkYXRhLnJlc3VsdC5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKSkgOiBkYXRhLnJlc3VsdDtcblx0XHRcdFx0dm0uY2F0Y2hhcnREYXRhID0gY2hhcnRTZXJ2aWNlLnNldENoYXJ0RGF0YSh2bS5zdWJDYXRzU3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdm0ub3B0aW9ucy5kYi50YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uLCB2bS5jYXRjaGFydExhYmVsKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9uU3ViQ2F0U2VsZWN0KGNhdCwgc3ViY2F0LCBpbmRleCkge1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0XHR0Y29scyA9IHRhYmxlcy5jYWxscy5jb2x1bW5zLFxuXHRcdFx0XHRjb2x1bW5zID0gW3Rjb2xzLm9wZXJhdG9yLCB0Y29scy5jdXN0b21lcl9waG9uZSwgdGNvbHMuY2FsbGRhdGUsIHRjb2xzLmNvbW1lbnRzXSxcblx0XHRcdFx0ZGF0YTtcblxuXHRcdFx0ZGVidWcubG9nKCdvblN1YkNhdFNlbGVjdDogJywgY2F0LCBzdWJjYXQsIGluZGV4KTtcblxuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueSkgY29sdW1ucy5wdXNoKHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5kZXNjcmlwdGlvbik7XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jdXN0b21lcl9uYW1lKSBjb2x1bW5zLnB1c2godGFibGVzLmNhbGxzLmNvbHVtbnMuY3VzdG9tZXJfbmFtZSk7XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0KSBjb2x1bW5zLnB1c2godGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCk7XG5cblx0XHRcdGdldENhdFByb2Nlc3Nlcyhjb2x1bW5zLCBjYXQsIHN1YmNhdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0ZGF0YSA9IHJlc3VsdC5kYXRhO1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0dm0ucHJvY2Vzc2VzID0gdXRpbHMucXVlcnlUb09iamVjdChkYXRhLnJlc3VsdCwgY29sdW1ucyk7XG5cdFx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9leHBvcnQtcHJvY2Vzc2VzLmh0bWwnLFxuXHRcdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdFx0XHRcdGJlZ2luOiB2bS5iZWdpbixcblx0XHRcdFx0XHRcdGVuZDogdm0uZW5kLFxuXHRcdFx0XHRcdFx0ZGF0YTogdm0ucHJvY2Vzc2VzXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb250cm9sbGVyOiAnUHJvY2Vzc2VzRXhwb3J0Q29udHJvbGxlcicsXG5cdFx0XHRcdFx0Y29udHJvbGxlckFzOiAncHJvY0V4cFZtJyxcblx0XHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5TZXR0aW5ncygkZXZlbnQsIGtpbmQpIHtcblx0XHRcdHZhciBkYXRhID0gdm0uZGF0YVtraW5kLm5hbWVdO1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9raW5kLXNldHRpbmdzLmh0bWwnLFxuXHRcdFx0XHRjb250cm9sbGVyOiAnS2luZFNldHRpbmdzQ29udHJvbGxlcicsXG5cdFx0XHRcdGNvbnRyb2xsZXJBczogJ2tpbmRTZXRWbScsXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdGtpbmQ6IGtpbmQsXG5cdFx0XHRcdFx0bGlzdDogZGF0YS5saXN0LFxuXHRcdFx0XHRcdHRhc2tzOiBkYXRhLnRhc2tzLFxuXHRcdFx0XHRcdGtpbmRNZXRyaWNzOiBkYXRhLm1ldHJpY3MsXG5cdFx0XHRcdFx0bWV0cmljczogZGVmYXVsdERhdGFba2luZC5uYW1lXS5tZXRyaWNzLFxuXHRcdFx0XHRcdHNsOiBkYXRhLnNsIHx8IG51bGwsXG5cdFx0XHRcdFx0ZGVmYXVsdFNMOiB2bS5vcHRpb25zLnNsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihvcHRzKSB7XG5cdFx0XHRcdGlmKG9wdHMuc2wpIGRhdGEuc2wgPSBvcHRzLnNsO1xuXHRcdFx0XHRkYXRhLm1ldHJpY3MgPSBvcHRzLm1ldHJpY3M7XG5cdFx0XHRcdGRhdGEubGlzdCA9IG9wdHMubGlzdDtcblxuXHRcdFx0XHQvLyBVcGRhdGUgZGF0YVxuXHRcdFx0XHR2bS5nZXRTdGF0KFtraW5kXSk7XG5cblx0XHRcdFx0Ly8gU2F2ZSBuZXcgZGF0YSB0byBzdG9yYWdlXG5cdFx0XHRcdHN0b3JlLnNldCgnZGF0YScsIHZtLmRhdGEpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhwb3J0RGFzaCgkZXZlbnQsIGtpbmRzKSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2V4cG9ydC1kaWFsb2cuaHRtbCcsXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdGtpbmRzOiBraW5kcyB8fCB2bS5vcHRpb25zLmtpbmRzLFxuXHRcdFx0XHRcdGRhdGE6IHZtLmRhdGEsXG5cdFx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4sXG5cdFx0XHRcdFx0ZW5kOiB2bS5lbmQsXG5cdFx0XHRcdFx0c3RhdDogdm0uc3RhdCxcblx0XHRcdFx0XHRwcmV2c3RhdDogdm0ucHJldnN0YXQsXG5cdFx0XHRcdFx0Y2F0c3RhdDogdm0uY2F0c3RhdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb250cm9sbGVyOiAnRGFzaEV4cG9ydENvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoRXhwVm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERlZmF1bHREYXRhKCl7XG5cdFx0XHR2YXIgZGF0YSA9IHN0b3JlLmdldCgnZGF0YScpO1xuXHRcdFx0aWYoIWRhdGEpIHtcblx0XHRcdFx0ZGF0YSA9IGRlZmF1bHREYXRhO1xuXHRcdFx0XHRzdG9yZS5zZXQoJ2RhdGEnLCBkYXRhKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERlZmF1bHRPcHRpb25zKCl7XG5cdFx0XHR2YXIgb3B0aW9ucyA9IHN0b3JlLmdldCgnb3B0aW9ucycpO1xuXHRcdFx0aWYoIW9wdGlvbnMpIHtcblx0XHRcdFx0b3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG9wdGlvbnM7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza3NTdGF0aXN0aWNzKHBhcmFtcywgb2JqKXtcblx0XHRcdHJldHVybiBhcGkuZ2V0VGFza0dyb3VwU3RhdGlzdGljcyhwYXJhbXMpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGE7XG5cblx0XHRcdFx0aWYoZGF0YS5lcnJvcikgcmV0dXJuIGVycm9yU2VydmljZS5zaG93KGRhdGEuZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRcdGlmKGRhdGEucmVzdWx0Lmxlbmd0aCkgYW5ndWxhci5leHRlbmQob2JqLCBkYXRhLnJlc3VsdC5yZWR1Y2UodXRpbHMuZXh0ZW5kQW5kU3VtKSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdGF0RGF0YSh0YXNrcywga2luZCl7XG5cdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdC8vIGlmKCF0YXNrcy5sZW5ndGgpIHJldHVybiByZWplY3QoKTtcblxuXHRcdFx0XHR2YXIgY3VyclBhcmFtcyA9IHt9LFxuXHRcdFx0XHRcdHByZXZQYXJhbXMgPSB7fSxcblx0XHRcdFx0XHRma2luZCA9IGtpbmQubmFtZSxcblx0XHRcdFx0XHRkYXRhID0gdm0uZGF0YVtma2luZF0sXG5cdFx0XHRcdFx0bWV0cmljcyA9IGRhdGEubWV0cmljcyB8fCB2bS5kYXRhW2ZraW5kXS5tZXRyaWNzLFxuXHRcdFx0XHRcdHNsSW5kZXggPSB1dGlscy5nZXRTbEluZGV4KG1ldHJpY3MpO1xuXG5cdFx0XHRcdGN1cnJQYXJhbXMgPSB7XG5cdFx0XHRcdFx0YmVnaW46IG5ldyBEYXRlKHZtLmJlZ2luKS52YWx1ZU9mKCksXG5cdFx0XHRcdFx0ZW5kOiBuZXcgRGF0ZSh2bS5lbmQpLnZhbHVlT2YoKSxcblx0XHRcdFx0XHRsaXN0OiB0YXNrcyxcblx0XHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0aWYoZGF0YS5zbCAmJiBzbEluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdGN1cnJQYXJhbXMubWV0cmljcy5wdXNoKCdzbCcrZGF0YS5zbCk7XG5cdFx0XHRcdH0gZWxzZSBpZihkYXRhLnNsICYmIG1ldHJpY3Nbc2xJbmRleF0gIT09ICdzbCcrZGF0YS5zbCkge1xuXHRcdFx0XHRcdGN1cnJQYXJhbXMubWV0cmljc1tzbEluZGV4XSA9ICdzbCcrZGF0YS5zbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHByZXZQYXJhbXMsIGN1cnJQYXJhbXMpO1xuXHRcdFx0XHRwcmV2UGFyYW1zLmJlZ2luID0gY3VyclBhcmFtcy5iZWdpbiAtIChjdXJyUGFyYW1zLmVuZCAtIGN1cnJQYXJhbXMuYmVnaW4pO1xuXHRcdFx0XHRwcmV2UGFyYW1zLmVuZCA9IGN1cnJQYXJhbXMuYmVnaW47XG5cdFx0XHRcdFxuXHRcdFx0XHR2bS5zdGF0W2ZraW5kXSA9IHRhc2tzLmxlbmd0aCA/ICh2bS5zdGF0W2ZraW5kXSB8fCB7fSkgOiB7fTtcblx0XHRcdFx0dm0ucHJldnN0YXRbZmtpbmRdID0gdGFza3MubGVuZ3RoID8gKHZtLnByZXZzdGF0W2ZraW5kXSB8fCB7fSkgOiB7fTtcblxuXHRcdFx0XHRnZXRUYXNrc1N0YXRpc3RpY3MoY3VyclBhcmFtcywgdm0uc3RhdFtma2luZF0pLnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRyZXR1cm4gZ2V0VGFza3NTdGF0aXN0aWNzKHByZXZQYXJhbXMsIHZtLnByZXZzdGF0W2ZraW5kXSk7XG5cdFx0XHRcdH0pLnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTYXZlIGFycmF5IG9mIHRhc2tzIHRvIHNjb3BlIHZhcmlhYmxlc1xuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQgLSBvYmplY3QsIHdoaWNoIGlzIHJldHVybmVkIGZyb20gZ2V0VGFza3MgcXVlcnkgb3IgYW4gYXJyYXkgb2YgdGFza3Ncblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRUYXNrcyhyZXN1bHQsIGtpbmQpe1xuXHRcdFx0dmFyIGRhdGEgPSByZXN1bHQuZGF0YSxcblx0XHRcdFx0dGFza3MgPSBkYXRhID8gZGF0YS5yZXN1bHQgOiByZXN1bHQsXG5cdFx0XHRcdGZraW5kID0ga2luZC5uYW1lO1xuXG5cdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdGlmKGRhdGEgJiYgZGF0YS5lcnIpIHJldHVybiByZWplY3QoZGF0YS5lcnIubWVzc2FnZSk7XG5cdFx0XHRcdGlmKCF0YXNrcykgcmV0dXJuIHJlamVjdCgnVGFza3MgaXMgdW5kZWZpbmVkJyk7XG5cblx0XHRcdFx0aWYoIXZtLmRhdGFbZmtpbmRdKSB7XG5cdFx0XHRcdFx0dm0uZGF0YVtma2luZF0gPSBkZWZhdWx0RGF0YS5kZWZhdWx0cztcblx0XHRcdFx0fVxuXHRcdFx0XHR2bS5kYXRhW2ZraW5kXS50YXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRcdGlmKCF2bS5kYXRhW2ZraW5kXS5saXN0Lmxlbmd0aCkgdm0uZGF0YVtma2luZF0ubGlzdCA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cblx0XHRcdFx0cmVzb2x2ZSh0YXNrcyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDYXRlZ29yaWVzU3RhdCgpe1xuXHRcdFx0dmFyIGRhdGEsIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0bWV0cmljcyA9IFsnbmNhJywgJ2F0dCcsICdhaHQnLCAnYXNhJywgJ3NsJyt2bS5kYXRhLkluY29taW5nX0FnZW50LnNsXTtcblx0XHRcdFxuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRtZXRyaWNzLnB1c2goJ3N1bShjYWxscmVzdWx0KScpO1xuXHRcdFx0XHQvLyB2bS5jYXRNZXRyaWNzLnB1c2goeyBpbmRleDogJ3N1bShjYWxscmVzdWx0KScsIG5hbWU6ICdDYWxsIHJlc29sdXRpb24nIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR2bS5vcHRpb25zLnRhYmxlc0xpc3QgPSBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLm5hbWVdO1xuXHRcdFx0Ly8gaWYodGFibGVzLmNvbXBhbmllcykgdm0ub3B0aW9ucy50YWJsZXNMaXN0LnB1c2godGFibGVzLmNvbXBhbmllcy5uYW1lKTtcblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdGFwaS5nZXRDdXN0b21MaXN0U3RhdGlzdGljcyh7XG5cdFx0XHRcdC8vIHRhYmxlczogWydwcm9ic3RhdCcsICdwcm9iY2F0JywgJ3Byb2Jjb21wYW55J10sXG5cdFx0XHRcdHRhYmxlczogdm0ub3B0aW9ucy50YWJsZXNMaXN0LFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2Jjb21wYW55PXByb2Jjb21wYW55LmNvbXBpZCcsXG5cdFx0XHRcdHRhYnJlbDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0Ly8gJyBhbmQgdGFza3R5cGUgaW4gKCcrZ2V0VGFza0tpbmRzKCkuam9pbignLCcpKycpJytcblx0XHRcdFx0XHRcdCcgYW5kIHRhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKCkuam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQnLFxuXHRcdFx0XHRcdFx0Ly8gKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnkgP1xuXHRcdFx0XHRcdFx0Ly8gJyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jb21wYW5pZXMubmFtZSwgdGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgOlxuXHRcdFx0XHRcdFx0Ly8gJycpLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnksIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHQvLyBjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnksIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKCksXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdGVnb3JpZXMtbG9hZGVyJylcblxuXHRcdFx0XHRkYXRhID0gcmVzdWx0LmRhdGE7XG5cdFx0XHRcdGlmKGRhdGEuZXJyb3IpIHJldHVybiBlcnJvclNlcnZpY2Uuc2hvdyhkYXRhLmVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8gdm0uY2F0VG90YWxzID0gZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscyk7XG5cdFx0XHRcdHZtLmNhdHN0YXQgPSBkYXRhLnJlc3VsdC5sZW5ndGggPyBzZXRDYXRzU3RhdChkYXRhLnJlc3VsdCwgZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscykpIDogZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0Q2F0ZWdvcmllc1N0YXQgY2F0c3RhdDogJywgdm0uY2F0c3RhdCk7XG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uY2F0c3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdm0uY2F0Y2hhcnRMYWJlbCk7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0Q2F0ZWdvcmllc1N0YXQgdm0uY2F0Y2hhcnREYXRhOiAnLCB2bS5jYXRjaGFydERhdGEpO1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdWJDYXRlZ29yaWVzU3RhdChjYXQpe1xuXHRcdFx0dmFyIGRhdGEsIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0bWV0cmljcyA9IFsnbmNhJywgJ2F0dCcsICdhaHQnLCAnYXNhJywgJ3NsJyt2bS5kYXRhLkluY29taW5nX0FnZW50LnNsXTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHQpIG1ldHJpY3MucHVzaCgnc3VtKGNhbGxyZXN1bHQpJyk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0Ly8gdGFibGVzOiBbJ3Byb2JzdGF0JywgJ3Byb2JjYXQnLCAncHJvYmRldGFpbHMnXSxcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWVdLFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9iY2F0LmNhdGRlc2M9XCInK2NhdCsnXCIgYW5kIHByb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmRldGFpbHM9cHJvYmRldGFpbHMuc3ViaWQnLFxuXHRcdFx0XHR0YWJyZWw6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJz0nK2NhdCtcblx0XHRcdFx0XHRcdC8vICcgYW5kIHRhc2t0eXBlIGluICgnK2dldFRhc2tLaW5kcygpLmpvaW4oJywnKSsnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJyksXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0U3ViQ2F0ZWdvcmllc1N0YXQgZGF0YTogJywgcmVzdWx0LmRhdGEpO1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0UHJvY2Vzc2VzKGNvbHVtbnMsIGNhdCwgc3ViY2F0KXtcblx0XHRcdGlmKCFjb2x1bW5zKSByZXR1cm47XG5cdFx0XHR2YXIgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXM7XG5cdFx0XHR2bS5vcHRpb25zLnRhYmxlc0xpc3QgPSBbdGFibGVzLnByb2Nlc3NlZC5uYW1lLCB0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZV07XG5cdFx0XHRpZih0YWJsZXMuY29tcGFuaWVzKSB2bS5vcHRpb25zLnRhYmxlc0xpc3QucHVzaCh0YWJsZXMuY29tcGFuaWVzLm5hbWUpO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0cmV0dXJuIGFwaS5nZXRRdWVyeVJlc3VsdFNldCh7XG5cdFx0XHRcdC8vIHRhYmxlczogWydwcm9jZXNzZWQnLCAncHJvYnN0YXQnLCAncHJvYmNhdCcsICdwcm9iZGV0YWlscycsICdwcm9iY29tcGFueSddLFxuXHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMudGFibGVzTGlzdCxcblx0XHRcdFx0Ly8gdGFicmVsOiAoY2F0ID8gJ3Byb2JjYXQuY2F0ZGVzYz1cIicrY2F0KydcIiBhbmQgJyA6ICcnKSArIChzdWJjYXQgPyAncHJvYmRldGFpbHMucHJvYmRlc2M9XCInK3N1YmNhdCsnXCIgYW5kICcgOiAnJykgKyAncHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iZGV0YWlscz1wcm9iZGV0YWlscy5zdWJpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiAoY2F0ICE9PSB1bmRlZmluZWQgPyBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKyc9JytjYXQrJyBhbmQgJyA6ICcnKSArXG5cdFx0XHRcdFx0XHQnIHRhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKCkuam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQgJytcblx0XHRcdFx0XHRcdChzdWJjYXQgIT09IHVuZGVmaW5lZCA/ICcgYW5kICcrW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnPScrc3ViY2F0IDogJycpICtcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0KHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5ICE9PSB1bmRlZmluZWQgPyAnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSA6ICcnKStcblx0XHRcdFx0XHRcdCh0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55ICE9PSB1bmRlZmluZWQgPyAnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueV0uam9pbignLicpKyc9JytbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSA6ICcnKSArXG5cdFx0XHRcdFx0XHQnIGFuZCBwcm9jZXNzZWQucHJvY2lkPScrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IGNvbHVtbnMsXG5cdFx0XHRcdC8vIGdyb3VwQnk6IHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbW1lbnRzLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhbGxSZXNvbHV0aW9uU3RhdCgpe1xuXHRcdFx0dmFyIGRhdGEsIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLCB0YXNrS2luZCA9IDEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudChjYWxscmVzdWx0KSddO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2Jjb21wYW55PXByb2Jjb21wYW55LmNvbXBpZCcsXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKFt0YXNrS2luZF0pLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0XS5qb2luKCcuJykrJyA9IDEnLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0sXG5cdFx0XHRcdC8vIGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhbGxSZXNvbHV0aW9uU3RhdCBkYXRhOiAnLCByZXN1bHQuZGF0YSk7XG5cdFx0XHRcdGlmKHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdFx0XHR2bS5nbG9iYWxDclt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSA9IHJlc3VsdC5kYXRhLnJlc3VsdFswXVsnY291bnQoY2FsbHJlc3VsdCknXTtcblx0XHRcdFx0XHRkZWJ1Zy5sb2coJ2dsb2JhbENyOiAnLCB2bS5nbG9iYWxDclt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSk7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0R2xvYmFsRnJjKCkge1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0XHR0YXNrS2luZCA9IDEsXG5cdFx0XHRcdHRhc2tzID0gZ2V0VGFza0lkcyhbdGFza0tpbmRdKTtcblxuXHRcdFx0ZGVidWcubG9nKCdnZXRHbG9iYWxGcmMgdGFza3M6JywgdGFza3NbMF0pO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUZDUlN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YXNrOiB0YXNrc1swXSxcblx0XHRcdFx0Ly8gdGFibGU6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdC8vIHByb2NpZDogdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZCxcblx0XHRcdFx0aW50ZXJ2YWw6IDM2MDAqMjQqMTAwMCxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpXG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLmdsb2JhbEZjciA9IHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGggPyAocmVzdWx0LmRhdGEucmVzdWx0XG5cdFx0XHRcdC5yZWR1Y2UodXRpbHMuZXh0ZW5kQW5kU3VtKSkgOiBbXTtcblx0XHRcdFx0XG5cdFx0XHRcdHZtLmdsb2JhbEZjci5mY3JSYXRlID0gdm0uZ2xvYmFsRmNyLmZjciAvIHZtLmdsb2JhbEZjci50b3RhbCAqIDEwMDtcblxuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldEdsb2JhbEZyYzogJywgdm0uZ2xvYmFsRmNyKTtcblxuXHRcdFx0XHQvLyBnZXQgcHJldiBzdGF0aXN0aWNzXG5cdFx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tRkNSU3RhdGlzdGljcyh7XG5cdFx0XHRcdFx0dGFzazogdGFza3NbMF0sXG5cdFx0XHRcdFx0Ly8gdGFibGU6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdFx0Ly8gcHJvY2lkOiB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkLFxuXHRcdFx0XHRcdGludGVydmFsOiAzNjAwKjI0KjEwMDAsXG5cdFx0XHRcdFx0YmVnaW46ICh2bS5iZWdpbi52YWx1ZU9mKCkgLSAodm0uZW5kLnZhbHVlT2YoKSAtIHZtLmJlZ2luLnZhbHVlT2YoKSkpLFxuXHRcdFx0XHRcdGVuZDogdm0uYmVnaW4udmFsdWVPZigpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLnByZXZHbG9iYWxGY3IgPSByZXN1bHQuZGF0YS5yZXN1bHQubGVuZ3RoID8gKHJlc3VsdC5kYXRhLnJlc3VsdFxuXHRcdFx0XHQucmVkdWNlKHV0aWxzLmV4dGVuZEFuZFN1bSkpIDogW107XG5cdFx0XHRcdFxuXHRcdFx0XHR2bS5wcmV2R2xvYmFsRmNyLmZjclJhdGUgPSB2bS5wcmV2R2xvYmFsRmNyLmZjciAvIHZtLnByZXZHbG9iYWxGY3IudG90YWwgKiAxMDA7XG5cblx0XHRcdFx0ZGVidWcubG9nKCdwcmV2R2xvYmFsRmNyOiAnLCB2bS5wcmV2R2xvYmFsRmNyKTtcblx0XHRcdH0pXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0TG9naW5zUmF0aW8oKSB7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsIHRhc2tLaW5kID0gMSxcblx0XHRcdHJkYXRhID0ge30sXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudChsb2dpbiknXTtcblx0XHRcdC8vIG1ldHJpY3MgPSBbJ2NvdW50KGNhc2Ugd2hlbiBsb2dpbiAhPSAwIHRoZW4gbG9naW4gZWxzZSBudWxsIGVuZCkgYXMgdGxvZ2lucyddO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2Jjb21wYW55PXByb2Jjb21wYW55LmNvbXBpZCcsXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKFt0YXNrS2luZF0pLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScgK1xuXHRcdFx0XHRcdFx0XCJhbmQgXCIrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5sb2dpbl0uam9pbignLicpK1wiICE9ICcwJ1wiLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0sXG5cdFx0XHRcdC8vIGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldExvZ2luc1JhdGlvIGRhdGE6ICcsIHJlc3VsdC5kYXRhKTtcblx0XHRcdFx0aWYocmVzdWx0LmRhdGEgJiYgcmVzdWx0LmRhdGEucmVzdWx0ICYmIHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZGF0YSA9IHJlc3VsdC5kYXRhLnJlc3VsdDtcblx0XHRcdFx0XHR2bS5zdGF0ID0gdm0uc3RhdCB8fCB7fTtcblx0XHRcdFx0XHR2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldID0gdm0uc3RhdFt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSB8fCB7fTtcblx0XHRcdFx0XHR2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldLm5jdSA9IHJkYXRhLnJlZHVjZShmdW5jdGlvbihwcmV2LCBuZXh0KSB7IFxuXHRcdFx0XHRcdFx0cmV0dXJuIHByZXYgKyBuZXh0Wydjb3VudChsb2dpbiknXTsgXG5cdFx0XHRcdFx0fSwgMCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0ZGVidWcubG9nKCdnZXRMb2dpbnNSYXRpbyBzdGF0OiAnLCB2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldKTtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZXRDYXRzU3RhdChkYXRhLCB0b3RhbHMpe1xuXHRcdFx0dmFyIGRhdGFWYWx1ZTtcblx0XHRcdFx0Ly8gdG90YWxzID0gZGF0YS5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKTtcblxuXHRcdFx0cmV0dXJuIHV0aWxzLnNldFBlcmNlbnRhZ2VWYWx1ZXMoZGF0YSwgdG90YWxzKS5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRcdGFuZ3VsYXIuZm9yRWFjaChpdGVtLCBmdW5jdGlvbih2YWx1ZSwga2V5KXtcblx0XHRcdFx0XHRkYXRhVmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKTtcblxuXHRcdFx0XHRcdGlmKCFpc05hTihkYXRhVmFsdWUpKSBpdGVtW2tleV0gPSBkYXRhVmFsdWU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIGZ1bmN0aW9uIHNldENoYXJ0RGF0YShhcnJheSwgZGF0YWtleSwgbGFiZWxrZXkpe1xuXHRcdC8vIFx0dmFyIG5ld0FycmF5ID0gW10sIGRhdGEgPSBbXSwgbGFiZWxzID0gW10sIGNvbG91cnMgPSBbXSwgaXRlbURhdGE7XG5cblx0XHQvLyBcdHNvcnRPYmpCeShhcnJheSwgZGF0YWtleSwgJ2Rlc2NlbmQnKVxuXHRcdC8vIFx0Lm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHQvLyBcdFx0ZGF0YS5wdXNoKGFuZ3VsYXIuaXNOdW1iZXIoaXRlbVtkYXRha2V5XSkgPyBpdGVtW2RhdGFrZXldLnRvRml4ZWQoMikgOiBpdGVtW2RhdGFrZXldICk7XG5cdFx0Ly8gXHRcdGxhYmVscy5wdXNoKGl0ZW1bbGFiZWxrZXldKTtcblx0XHQvLyBcdFx0Y29sb3Vycy5wdXNoKGdldENhdGVnb3J5Q29sb3VyKGl0ZW1bbGFiZWxrZXldKSk7XG5cdFx0Ly8gXHR9KTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0Ly8gXHRzdG9yZS5zZXQoJ29wdGlvbnMnLCB2bS5vcHRpb25zKTtcblxuXHRcdC8vIFx0cmV0dXJuIHtcblx0XHQvLyBcdFx0ZGF0YTogZGF0YSxcblx0XHQvLyBcdFx0bGFiZWxzOiBsYWJlbHMsXG5cdFx0Ly8gXHRcdGNvbG91cnM6IGNvbG91cnNcblx0XHQvLyBcdH07XG5cdFx0Ly8gfVxuXG5cdFx0Ly8gZnVuY3Rpb24gZ2V0Q2F0ZWdvcnlDb2xvdXIoY2F0KXtcblx0XHQvLyBcdHZhciBjYXRDb2xvdXJzID0gdm0ub3B0aW9ucy5jYXRDb2xvdXJzLFxuXHRcdC8vIFx0XHRmb3VuZCA9IGZhbHNlLCBjb2xvdXIgPSAnJztcblxuXHRcdC8vIFx0Y2F0Q29sb3Vycy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdC8vIFx0XHRpZihpdGVtLm5hbWUgPT09IGNhdCkgZm91bmQgPSBpdGVtO1xuXHRcdC8vIFx0fSk7XG5cblx0XHQvLyBcdGlmKGZvdW5kKSB7XG5cdFx0Ly8gXHRcdGNvbG91ciA9IGZvdW5kLmNvbG91cjtcblx0XHQvLyBcdH0gZWxzZSB7XG5cdFx0Ly8gXHRcdGNvbG91ciA9IGNvbG91ckdlbmVyYXRvci5nZXRDb2xvcigpO1xuXHRcdC8vIFx0XHR2bS5vcHRpb25zLmNhdENvbG91cnMucHVzaCh7IG5hbWU6IGNhdCwgY29sb3VyOiBjb2xvdXIgfSk7XG5cdFx0Ly8gXHR9XG5cdFx0Ly8gXHRyZXR1cm4gY29sb3VyO1xuXHRcdC8vIH1cblxuXG5cdFx0Ly8gZnVuY3Rpb24gc29ydE9iakJ5KGFycmF5LCBrZXksIGRlc2NlbmQpe1xuXHRcdC8vIFx0dmFyIHNvcnRlZCA9IGFycmF5LnNvcnQoZnVuY3Rpb24oYSwgYil7XG5cdFx0Ly8gXHRcdGlmKGFba2V5XSA+IGJba2V5XSkgcmV0dXJuIGRlc2NlbmQgPyAtMSA6IDE7XG5cdFx0Ly8gXHRcdGlmKGFba2V5XSA8IGJba2V5XSkgcmV0dXJuIGRlc2NlbmQgPyAxIDogLTE7XG5cdFx0Ly8gXHRcdHJldHVybiAwO1xuXHRcdC8vIFx0fSk7XG5cdFx0Ly8gXHRyZXR1cm4gc29ydGVkO1xuXHRcdC8vIH1cblxuXHRcdGZ1bmN0aW9uIGdldFRhc2tLaW5kcygpe1xuXHRcdFx0cmV0dXJuIHZtLm9wdGlvbnMua2luZHMubWFwKGZ1bmN0aW9uKGl0ZW0peyByZXR1cm4gaXRlbS5raW5kOyB9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRUYXNrSWRzKGtpbmRzKXtcblx0XHRcdHZhciBpZHMgPSBbXTtcblx0XHRcdGFuZ3VsYXIuZm9yRWFjaCh2bS5kYXRhLCBmdW5jdGlvbih2YWx1ZSwga2V5KXtcblx0XHRcdFx0aWYodmFsdWUubGlzdC5sZW5ndGgpIHtcblx0XHRcdFx0XHRpZihraW5kcykge1xuXHRcdFx0XHRcdFx0aWYoa2luZHMuaW5kZXhPZih2YWx1ZS5raW5kKSA+IC0xKSBpZHMucHVzaCh2YWx1ZS5saXN0KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWRzLnB1c2godmFsdWUubGlzdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYoaWRzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gaWRzLnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXJyKXtcblx0XHRcdFx0XHRyZXR1cm4gcHJldi5jb25jYXQoY3Vycik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGlkcztcblx0XHRcdH1cblx0XHR9XG5cblx0fVxuXG59KSgpOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcbi5jb25maWcoWyckcm91dGVQcm92aWRlcicsIGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKXtcblxuXHQkcm91dGVQcm92aWRlci5cblx0XHR3aGVuKCcvZGFzaGJvYXJkJywge1xuXHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQvZGFzaGJvYXJkLmh0bWwnLFxuXHRcdFx0Y29udHJvbGxlcjogJ0Rhc2hDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2Rhc2hWbSdcblx0XHR9KTtcbn1dKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5jb250cm9sbGVyKCdLaW5kU2V0dGluZ3NDb250cm9sbGVyJywgS2luZFNldHRpbmdzQ29udHJvbGxlcik7XG5cblx0S2luZFNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJG1kRGlhbG9nJywgJ2tpbmQnLCAnbGlzdCcsICd0YXNrcycsICdraW5kTWV0cmljcycsICdtZXRyaWNzJywgJ3NsJywgJ2RlZmF1bHRTTCddO1xuXG5cdGZ1bmN0aW9uIEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIoJHNjb3BlLCAkbWREaWFsb2csIGtpbmQsIGxpc3QsIHRhc2tzLCBraW5kTWV0cmljcywgbWV0cmljcywgc2wsIGRlZmF1bHRTTCkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLmtpbmQgPSBraW5kO1xuXHRcdHZtLmxpc3QgPSBbXS5jb25jYXQobGlzdCk7XG5cdFx0dm0udGFza3MgPSBbXS5jb25jYXQodGFza3MpLnNvcnQoKTtcblx0XHR2bS5raW5kTWV0cmljcyA9IFtdLmNvbmNhdChraW5kTWV0cmljcyk7XG5cdFx0dm0ubWV0cmljcyA9IFtdLmNvbmNhdChtZXRyaWNzKTtcblx0XHR2bS5zbCA9IHNsO1xuXHRcdHZtLmRlZmF1bHRTTCA9IGRlZmF1bHRTTDtcblx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gdm0ubGlzdC5sZW5ndGggPT09IHZtLnRhc2tzLmxlbmd0aDtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmV4aXN0cyA9IGV4aXN0cztcblx0XHR2bS5zZWxlY3RBbGxUYXNrcyA9IHNlbGVjdEFsbFRhc2tzO1xuXG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpe1xuXHRcdFx0cmV0dXJuIHZtLmxpc3QubGVuZ3RoO1xuXHRcdH0sIGZ1bmN0aW9uKHZhbCl7XG5cdFx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gdm0ubGlzdC5sZW5ndGggPT09IHZtLnRhc2tzLmxlbmd0aDtcblx0XHR9KTtcblxuXHRcdGZ1bmN0aW9uIHNhdmUoKSB7XG5cdFx0XHRjb25zb2xlLmxvZygna2luZCBzZXR0czonLCB2bS5saXN0KTtcblx0XHRcdCRtZERpYWxvZy5oaWRlKHtcblx0XHRcdFx0c2w6IHZtLnNsLFxuXHRcdFx0XHRtZXRyaWNzOiB2bS5raW5kTWV0cmljcyxcblx0XHRcdFx0bGlzdDogdm0ubGlzdFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0QWxsVGFza3MoKSB7XG5cdFx0XHRpZih2bS5hbGxUYXNrc1NlbGVjdGVkKSB2bS5saXN0ID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHRcdGVsc2Ugdm0ubGlzdCA9IFtdO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNsb3NlU2V0dGluZ3MoKSB7XG5cdFx0XHQkbWREaWFsb2cuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdG9nZ2xlKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHZhciBpZHggPSBsaXN0LmluZGV4T2YoaXRlbSk7XG5cdFx0XHRpZiAoaWR4ID4gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleGlzdHMoaXRlbSwgbGlzdCkge1xuXHRcdFx0cmV0dXJuIGxpc3QuaW5kZXhPZihpdGVtKSA+IC0xO1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignUHJvY2Vzc2VzRXhwb3J0Q29udHJvbGxlcicsIFByb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXIpO1xuXG5cdFByb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRmaWx0ZXInLCAnJG1kRGlhbG9nJywgJ3RhYmxlcycsICdiZWdpbicsICdlbmQnLCAnZGF0YScsICd1dGlsc1NlcnZpY2UnLCAnZGVidWdTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gUHJvY2Vzc2VzRXhwb3J0Q29udHJvbGxlcigkc2NvcGUsICRmaWx0ZXIsICRtZERpYWxvZywgdGFibGVzLCBiZWdpbiwgZW5kLCBkYXRhLCB1dGlscywgZGVidWcpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS50YWJsZXMgPSB0YWJsZXM7XG5cdFx0dm0uYmVnaW4gPSBiZWdpbjtcblx0XHR2bS5lbmQgPSBlbmQ7XG5cdFx0dm0uZGF0YSA9IGRhdGE7XG5cblx0XHRkZWJ1Zy5sb2coJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXI6ICcsIHZtLmRhdGEpO1xuXG5cdFx0dm0ub3JkZXIgPSB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxsZGF0ZSxcblx0XHR2bS5zZWFyY2ggPSAnJztcblx0XHR2bS5maWx0ZXIgPSB7XG5cdFx0XHRjYWxscmVzdWx0OiAnJ1xuXHRcdH07XG5cblx0XHR2bS5leHBvcnROYW1lID0gJ3Byb2Nlc3Nlcyc7XG5cdFx0Ly8gdm0uZXhwb3J0TmFtZSA9ICRmaWx0ZXIoJ2RhdGUnKSh2bS5iZWdpbiwgJ2RkLk1NLnl5JykgKyAnLScgKyAkZmlsdGVyKCdkYXRlJykodm0uZW5kLCAnZGQuTU0ueXknKTtcblxuXHRcdHZtLmZpbHRlckJ5UmVzdWx0ID0gZnVuY3Rpb24oYWN0dWFsLCBleHBlY3RlZCkge1xuXHRcdFx0cmV0dXJuIHZtLmZpbHRlci5jYWxscmVzdWx0ID8gKGFjdHVhbC5jYWxscmVzdWx0LnRvU3RyaW5nKCkgPT09IHZtLmZpbHRlci5jYWxscmVzdWx0KSA6IHRydWU7XG5cblx0XHR9O1xuXG5cdFx0dm0uY2xvc2UgPSBmdW5jdGlvbigpe1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoKTtcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5kaXJlY3RpdmUoJ3N0YXRDYXJkJywgc3RhdENhcmQpO1xuXG5cdGZ1bmN0aW9uIHN0YXRDYXJkKCl7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBRScsXG5cdFx0XHRyZXBsYWNlOiB0cnVlLFxuXHRcdFx0c2NvcGU6IHtcblx0XHRcdFx0bW9kZWw6ICdAJyxcblx0XHRcdFx0dGl0bGU6ICdAJyxcblx0XHRcdFx0c3ViaGVhZDogJ0AnLFxuXHRcdFx0XHRwcmV2c3RhdDogJ0AnLFxuXHRcdFx0XHRkeW5hbWljczogJ0AnLFxuXHRcdFx0XHRjYXJkQ2xhc3M6ICdAJyxcblx0XHRcdFx0ZmxleFZhbHVlOiAnQCdcblx0XHRcdH0sXG5cdFx0XHR0ZW1wbGF0ZVVybDogJ2Fzc2V0cy9wYXJ0aWFscy9jYXJkLmh0bWwnXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuY3JyJylcblx0XHQuY29udHJvbGxlcignRmNyU2V0dGluZ3NDb250cm9sbGVyJywgRmNyU2V0dGluZ3NDb250cm9sbGVyKTtcblxuXHRGY3JTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRtZERpYWxvZycsICd0YXNrcycsICdjYXRzJywgJ3N1YmNhdHMnLCAnc2VsZWN0ZWRDYXRzJywgJ3NlbGVjdGVkU3ViY2F0cycsICdzZWxlY3RlZFRhc2tzJywgJ2RlYnVnU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIEZjclNldHRpbmdzQ29udHJvbGxlcigkc2NvcGUsICRtZERpYWxvZywgdGFza3MsIGNhdHMsIHN1YmNhdHMsIHNlbGVjdGVkQ2F0cywgc2VsZWN0ZWRTdWJjYXRzLCBzZWxlY3RlZFRhc2tzLCBkZWJ1Zykge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHNlbGVjdGVkVGFza3MpO1xuXHRcdHZtLmNhdHMgPSBjYXRzO1xuXHRcdHZtLnN1YmNhdHMgPSBzdWJjYXRzO1xuXHRcdHZtLnNlbGVjdGVkQ2F0cyA9IFtdLmNvbmNhdChzZWxlY3RlZENhdHMpO1xuXHRcdHZtLnNlbGVjdGVkU3ViY2F0cyA9IFtdLmNvbmNhdChzZWxlY3RlZFN1YmNhdHMpO1xuXHRcdHZtLnNlbGVjdEFsbFRhc2tzID0gc2VsZWN0QWxsVGFza3M7XG5cdFx0dm0uc2VsZWN0QWxsQ2F0cyA9IHNlbGVjdEFsbENhdHM7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9ICh0YXNrcy5sZW5ndGggPT09IHNlbGVjdGVkVGFza3MubGVuZ3RoKTtcblx0XHR2bS5hbGxDYXRzU2VsZWN0ZWQgPSAoY2F0cy5sZW5ndGggPT09IHNlbGVjdGVkQ2F0cy5sZW5ndGgpO1xuXHRcdHZtLnNhdmUgPSBzYXZlO1xuXHRcdHZtLmNsb3NlID0gY2xvc2VTZXR0aW5ncztcblx0XHR2bS50b2dnbGUgPSB0b2dnbGU7XG5cdFx0dm0uaW5kZXggPSBpbmRleDtcblx0XHR2bS5leGlzdHMgPSBleGlzdHM7XG5cdFx0dm0uc2hvd1N1YmNhdHMgPSBzaG93U3ViY2F0cztcblx0XHR2bS5zZWxlY3RDYXQgPSBzZWxlY3RDYXQ7XG5cdFx0dm0uc2VsZWN0ZWRDYXQgPSBudWxsO1xuXG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpe1xuXHRcdFx0cmV0dXJuIHZtLnNlbGVjdGVkVGFza3MubGVuZ3RoO1xuXHRcdH0sIGZ1bmN0aW9uKHZhbCl7XG5cdFx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gdm0uc2VsZWN0ZWRUYXNrcy5sZW5ndGggPT09IHZtLnRhc2tzLmxlbmd0aDtcblx0XHR9KTtcblxuXHRcdGRlYnVnLmxvZygndGFza3NtIHNlbGVjdGVkVGFza3M6ICcsIHZtLnRhc2tzLCB2bS5zZWxlY3RlZFRhc2tzKTtcblx0XHRkZWJ1Zy5sb2coJ3Rhc2tzbSBzZWxlY3RlZENhdHM6ICcsIHZtLmNhdHMsIHZtLnNlbGVjdGVkQ2F0cyk7XG5cdFx0ZGVidWcubG9nKCd0YXNrc20gc2VsZWN0ZWRTdWJjYXRzOiAnLCB2bS5jYXRzLCB2bS5zZWxlY3RlZFN1YmNhdHMpO1xuXG5cdFx0ZnVuY3Rpb24gc2F2ZSgpIHtcblx0XHRcdCRtZERpYWxvZy5oaWRlKHtcblx0XHRcdFx0c2VsZWN0ZWRUYXNrczogdm0uc2VsZWN0ZWRUYXNrcyxcblx0XHRcdFx0c2VsZWN0ZWRDYXRzOiB2bS5zZWxlY3RlZENhdHMsXG5cdFx0XHRcdHNlbGVjdGVkU3ViY2F0czogdm0uc2VsZWN0ZWRTdWJjYXRzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNob3dTdWJjYXRzKGNhdGlkKSB7XG5cdFx0XHR2bS5zZWxlY3RlZENhdCA9IGNhdGlkO1xuXHRcdFx0Y29uc29sZS5sb2coJ3Nob3dTdWJjYXRzOiAnLCBjYXRpZCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0Q2F0KGNhdGlkLCBjaGVja2VkKSB7XG5cdFx0XHRkZWJ1Zy5sb2coJ3NlbGVjdENhdDogJywgY2hlY2tlZCwgY2F0aWQpO1xuXHRcdFx0dG9nZ2xlKGNhdGlkLCB2bS5zZWxlY3RlZENhdHMpO1xuXHRcdFx0aWYoIWNoZWNrZWQpIHNlbGVjdEFsbFN1YmNhdHMoY2F0aWQpO1xuXHRcdFx0ZWxzZSBkZXNlbGVjdEFsbFN1YmNhdHMoY2F0aWQpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0uc2VsZWN0ZWRUYXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLnNlbGVjdGVkVGFza3MgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZWxlY3RBbGxDYXRzKCkge1xuXHRcdFx0aWYodm0uYWxsQ2F0c1NlbGVjdGVkKSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0cyA9IFtdLmNvbmNhdChjYXRzKS5tYXAoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gaXRlbS5pZCB9KTtcblx0XHRcdFx0c2VsZWN0QWxsU3ViY2F0cygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRDYXRzID0gW107XG5cdFx0XHRcdGRlc2VsZWN0QWxsU3ViY2F0cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFN1YmNhdHMoY2F0aWQpIHtcblx0XHRcdHZhciBjYXRTdWJjYXRzID0gdm0uc3ViY2F0cy5maWx0ZXIoZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRyZXR1cm4gaXRlbS5jYXRpZCA9PT0gY2F0aWQ7XG5cdFx0XHR9KVxuXHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtLmlkO1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmKGNhdGlkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzID0gdm0uc2VsZWN0ZWRTdWJjYXRzLmNvbmNhdChjYXRTdWJjYXRzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkU3ViY2F0cy5sZW5ndGggPSAwOyBcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzID0gdm0uc2VsZWN0ZWRTdWJjYXRzLmNvbmNhdCh2bS5zdWJjYXRzLm1hcChmdW5jdGlvbihpdGVtKSB7IHJldHVybiBpdGVtLmlkIH0pKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0ZGVidWcubG9nKCdzZWxlY3RBbGxTdWJjYXRzOiAnLCBjYXRpZCwgY2F0U3ViY2F0cywgdm0uc2VsZWN0ZWRTdWJjYXRzKTtcblxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGRlc2VsZWN0QWxsU3ViY2F0cyhjYXRpZCkge1xuXHRcdFx0dmFyIGNhdFN1YmNhdHMgPSB2bS5zdWJjYXRzLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtLmNhdGlkID09PSBjYXRpZDtcblx0XHRcdH0pXG5cdFx0XHQubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0uaWQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYoY2F0aWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjYXRTdWJjYXRzLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRcdGlmKHZtLnNlbGVjdGVkU3ViY2F0cy5pbmRleE9mKGl0ZW0pICE9PSAtMSlcblx0XHRcdFx0XHRcdHZtLnNlbGVjdGVkU3ViY2F0cy5zcGxpY2Uodm0uc2VsZWN0ZWRTdWJjYXRzLmluZGV4T2YoaXRlbSksIDEpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkU3ViY2F0cy5sZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdG9nZ2xlKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHZhciBpZHggPSBpbmRleChpdGVtLCBsaXN0KTtcblx0XHRcdGlmIChpZHggIT09IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gaW5kZXgoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IC0xO1xuXHRcdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGxpc3RJdGVtLCBpbmRleCl7XG5cdFx0XHRcdGlmKGxpc3RJdGVtID09IGl0ZW0pIGlkeCA9IGluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaWR4O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGV4aXN0cyhpdGVtLCBsaXN0KSB7XG5cdFx0XHRyZXR1cm4gbGlzdC5pbmRleE9mKGl0ZW0pID4gLTE7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5mY3InKVxuXHRcdC5jb250cm9sbGVyKCdGY3JDb250cm9sbGVyJywgRmNyQ29udHJvbGxlcik7XG5cblx0RmNyQ29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJywgJyRxJywgJyRtZERpYWxvZycsICdTZXR0aW5nc1NlcnZpY2UnLCAnYXBpU2VydmljZScsICdzdG9yZScsICdUYXNrc1NlcnZpY2UnLCAndXRpbHNTZXJ2aWNlJywgJ2RlYnVnU2VydmljZScsICdzcGlubmVyU2VydmljZScsICdjaGFydFNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gRmNyQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkcSwgJG1kRGlhbG9nLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgc3RvcmUsIFRhc2tzU2VydmljZSwgdXRpbHMsIGRlYnVnLCBzcGlubmVyU2VydmljZSwgY2hhcnRTZXJ2aWNlLCBlcnJvclNlcnZpY2UpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHRPcHRpb25zID0ge1xuXHRcdFx0cGVyaW9kOiAnMSBtb250aCcsXG5cdFx0XHRpbnRlcnZhbDogMzYwMCoyNCoxMDAwXG5cdFx0fTtcblx0XHR2YXIgY2F0RmNyID0ge307XG5cdFx0dmFyIHN1YmNhdEZjciA9IHt9O1xuXHRcdHZhciBhZ2VudHNGY3IgPSB7fTtcblxuXHRcdHZtLnNldHRpbmdzID0ge307XG5cdFx0dm0udGFza3MgPSBbXTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW107XG5cdFx0dm0uc2VsZWN0ZWRDYXQgPSBudWxsO1xuXHRcdHZtLnNlbGVjdGVkU3ViY2F0ID0gbnVsbDtcblx0XHR2bS5jYXRzID0gW107XG5cdFx0dm0uc3ViY2F0cyA9IFtdO1xuXHRcdHZtLnNlbGVjdGVkQ2F0cyA9IFtdO1xuXHRcdHZtLnNlbGVjdGVkU3ViY2F0cyA9IFtdO1xuXHRcdHZtLmFnZW50c0ZjciA9IFtdO1xuXHRcdHZtLnRvdGFsQWdlbnRzRmNyID0gW107XG5cdFx0dm0uY2F0RmNyID0gW107XG5cdFx0dm0udG90YWxDYXRGY3IgPSBbXTtcblx0XHR2bS5zdWJjYXRGY3IgPSBbXTtcblx0XHR2bS50b3RhbFN1YmNhdEZjciA9IFtdO1xuXHRcdHZtLmJlZ2luID0gdXRpbHMucGVyaW9kVG9SYW5nZShkZWZhdWx0T3B0aW9ucy5wZXJpb2QpLmJlZ2luO1xuXHRcdHZtLmVuZCA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdE9wdGlvbnMucGVyaW9kKS5lbmQ7XG5cdFx0dm0uZ2V0Q2F0RmNyID0gZ2V0Q2F0RmNyO1xuXHRcdHZtLm9wZW5TZXR0aW5ncyA9IG9wZW5TZXR0aW5ncztcblx0XHR2bS50YWJsZVNvcnQgPSAnZmNyUmF0ZSc7XG5cdFx0dm0uZ2V0RmNyID0gZ2V0RmNyO1xuXHRcdHZtLmdldEFnZW50RmNyID0gZ2V0QWdlbnRGY3I7XG5cdFx0dm0ub25DYXRTZWxlY3QgPSBvbkNhdFNlbGVjdDtcblx0XHR2bS5vblN1YmNhdFNlbGVjdCA9IG9uU3ViY2F0U2VsZWN0O1xuXHRcdHZtLmNvdW50RmNyID0gY291bnRGY3I7XG5cblx0XHRpbml0KCk7XG5cdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnbWFpbi1sb2FkZXInKTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKSB7XG5cdFx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdFx0cmV0dXJuIFRhc2tzU2VydmljZS5nZXRUYXNrTGlzdCgxKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ3Rhc2tzOiAnLCB0YXNrcy5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdHZtLnRhc2tzID0gdGFza3MuZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSBzdG9yZS5nZXQoJ3NlbGVjdGVkVGFza3MnKSB8fCB0YXNrcy5kYXRhLnJlc3VsdDtcblx0XHRcdFx0dm0uc2VsZWN0ZWRDYXRzID0gc3RvcmUuZ2V0KCdzZWxlY3RlZENhdHMnKSB8fCBbXTtcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzID0gc3RvcmUuZ2V0KCdzZWxlY3RlZFN1YmNhdHMnKSB8fCBbXTtcblxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdtYWluLWxvYWRlcicpO1xuXG5cdFx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGdldENhdGVnb3JpZXMpXG5cdFx0XHQudGhlbihnZXRTdWJjYXRlZ29yaWVzKVxuXHRcdFx0LnRoZW4oZ2V0RmNyKVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRGY3IoKSB7XG5cdFx0XHRyZXR1cm4gZ2V0QWdlbnRGY3IoKVxuXHRcdFx0LnRoZW4oZ2V0Q2F0RmNyKVxuXHRcdFx0LnRoZW4oZ2V0U3ViY2F0RmNyKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5TZXR0aW5ncygkZXZlbnQpIHtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdmY3IvZmNyLXNldHRpbmdzLmh0bWwnLFxuXHRcdFx0XHRjb250cm9sbGVyOiAnRmNyU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnZmNyU2V0dHNWbScsXG5cdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRsb2NhbHM6IHtcblx0XHRcdFx0XHR0YXNrczogdm0udGFza3MsXG5cdFx0XHRcdFx0Y2F0czogdm0uY2F0cyxcblx0XHRcdFx0XHRzdWJjYXRzOiB2bS5zdWJjYXRzLFxuXHRcdFx0XHRcdHNlbGVjdGVkQ2F0czogdm0uc2VsZWN0ZWRDYXRzLFxuXHRcdFx0XHRcdHNlbGVjdGVkU3ViY2F0czogdm0uc2VsZWN0ZWRTdWJjYXRzLFxuXHRcdFx0XHRcdHNlbGVjdGVkVGFza3M6IHZtLnNlbGVjdGVkVGFza3Ncblx0XHRcdFx0fVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IHJlc3VsdC5zZWxlY3RlZFRhc2tzO1xuXHRcdFx0XHR2bS5zZWxlY3RlZENhdHMgPSByZXN1bHQuc2VsZWN0ZWRDYXRzO1xuXHRcdFx0XHR2bS5zZWxlY3RlZFN1YmNhdHMgPSByZXN1bHQuc2VsZWN0ZWRTdWJjYXRzO1xuXG5cdFx0XHRcdHN0b3JlLnNldCgnc2VsZWN0ZWRUYXNrcycsIHZtLnNlbGVjdGVkVGFza3MpO1xuXHRcdFx0XHRzdG9yZS5zZXQoJ3NlbGVjdGVkQ2F0cycsIHZtLnNlbGVjdGVkQ2F0cyk7XG5cdFx0XHRcdHN0b3JlLnNldCgnc2VsZWN0ZWRTdWJjYXRzJywgdm0uc2VsZWN0ZWRTdWJjYXRzKTtcblxuXHRcdFx0XHRkZWJ1Zy5sb2coJ29wZW5TZXR0aW5ncyBjbG9zZWQ6ICcsIHZtLnNlbGVjdGVkQ2F0cywgdm0uc2VsZWN0ZWRTdWJjYXRzKTtcblxuXHRcdFx0XHRnZXRGY3IoKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIGZ1bmN0aW9uIHNldENoYXJ0cygpIHtcblx0XHQvLyBcdHZtLmNhdENoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uYWdlbnRzRmNyLCAnZmNyUmF0ZScsICdhZ2VudCcpO1xuXHRcdC8vIFx0dm0uYUNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uY2F0RmNyLCAnZmNyUmF0ZScsICdjYXRkZXNjJyk7XG5cdFx0Ly8gXHRkZWJ1Zy5sb2coJ3ZtLmNhdENoYXJ0RGF0YTogJywgdm0uY2F0Q2hhcnREYXRhKTtcblx0XHQvLyBcdGRlYnVnLmxvZygndm0uYUNoYXJ0RGF0YTogJywgdm0uYUNoYXJ0RGF0YSk7XG5cdFx0Ly8gfVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0ZWdvcmllcygpe1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcztcblx0XHRcdFxuXHRcdFx0cmV0dXJuIGFwaS5nZXRRdWVyeVJlc3VsdFNldCh7XG5cdFx0XHRcdHRhYmxlczogW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWVdLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0sXG5cdFx0XHRcdGdyb3VwQnk6IHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24oY2F0cyl7XG5cdFx0XHRcdHZtLmNhdHMgPSBjYXRzLmRhdGEucmVzdWx0Lmxlbmd0aCA/IChjYXRzLmRhdGEucmVzdWx0Lm1hcChmdW5jdGlvbihjYXQpIHsgcmV0dXJuIHsgZGVzYzogY2F0WzBdLCBpZDogY2F0WzFdIH0gfSkpIDogW107XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0cyA9IHZtLnNlbGVjdGVkQ2F0cy5sZW5ndGggPyB2bS5zZWxlY3RlZENhdHMgOiBbXS5jb25jYXQodm0uY2F0cykubWFwKGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIGl0ZW0uaWQgfSk7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0Q2F0ZWdvcmllczogJywgdm0uY2F0cywgdm0uc2VsZWN0ZWRDYXRzKTtcblxuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0U3ViY2F0ZWdvcmllcygpe1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcztcblx0XHRcdFxuXHRcdFx0cmV0dXJuIGFwaS5nZXRRdWVyeVJlc3VsdFNldCh7XG5cdFx0XHRcdHRhYmxlczogW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWVdLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSsnLicrdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZCwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0sXG5cdFx0XHRcdHRhYnJlbDogdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSsnLicrdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5jYXRlZ29yeV9pZCsnPScrdGFibGVzLmNhdGVnb3JpZXMubmFtZSsnLicrdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZCxcblx0XHRcdFx0Z3JvdXBCeTogW3RhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHN1YmNhdHMpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldFN1YmNhdGVnb3JpZXM6ICcsIHN1YmNhdHMpO1xuXHRcdFx0XHR2bS5zdWJjYXRzID0gc3ViY2F0cy5kYXRhLnJlc3VsdC5sZW5ndGggPyAoc3ViY2F0cy5kYXRhLnJlc3VsdC5tYXAoZnVuY3Rpb24oc3ViY2F0KSB7IHJldHVybiB7IGNhdGlkOiBzdWJjYXRbMV0sIGRlc2M6IHN1YmNhdFsyXSwgaWQ6IHN1YmNhdFszXSB9IH0pKSA6IFtdO1xuXHRcdFx0XHR2bS5zZWxlY3RlZFN1YmNhdHMgPSB2bS5zZWxlY3RlZFN1YmNhdHMubGVuZ3RoID8gdm0uc2VsZWN0ZWRTdWJjYXRzIDogW10uY29uY2F0KHZtLnN1YmNhdHMpLm1hcChmdW5jdGlvbihpdGVtKSB7IHJldHVybiBpdGVtLmlkIH0pO1xuXG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRBZ2VudEZjcigpIHtcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5zZXR0aW5ncy50YWJsZXM7XG5cdFx0XHR2YXIgb3B0cyA9IHtcblx0XHRcdFx0dGFzazogdm0udGFza3NbMF0sXG5cdFx0XHRcdHRhYmxlOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRpbnRlcnZhbDogMzYwMCoyNCoxMDAwLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLCBcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpXG5cdFx0XHR9XG5cblx0XHRcdGlmKCF2bS5zZWxlY3RlZENhdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdhZ2VudHMtZmNyLWxvYWRlcicpO1xuXHRcdFx0XG5cdFx0XHRvcHRzLnRhYmxlLnB1c2godGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSk7XG5cdFx0XHRvcHRzLndoZXJlID0gW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JysgW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKTtcblx0XHRcdG9wdHMud2hlcmUgKz0gJyBhbmQgJyArIFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrIFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJyk7XG5cdFx0XHRvcHRzLndoZXJlICs9ICcgYW5kICcgKyBbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKycgaW4gJythcnJheVRvSW4odm0uc2VsZWN0ZWRTdWJjYXRzKTtcblxuXHRcdFx0Ly8gaWYgY2F0ZWdvcnkgc2VsZWN0ZWQgXG5cdFx0XHRpZih2bS5zZWxlY3RlZENhdCAhPT0gbnVsbCkge1xuXHRcdFx0XHRvcHRzLndoZXJlICs9ICcgYW5kICcgKyBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0uam9pbignLicpKyc9XFwnJyt2bS5zZWxlY3RlZENhdCsnXFwnJztcblxuXHRcdFx0XHQvLyBpZiBzdWJjYXRlZ29yeSBzZWxlY3RlZCBcblx0XHRcdFx0aWYodm0uc2VsZWN0ZWRTdWJjYXQgIT09IG51bGwpIHtcblx0XHRcdFx0XHRvcHRzLndoZXJlICs9ICcgYW5kICcgKyBbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0uam9pbignLicpKyc9XFwnJyt2bS5zZWxlY3RlZFN1YmNhdCsnXFwnJztcblx0XHRcdFx0fVxuXG5cdFx0XHR9IFxuXHRcdFx0ZWxzZSBpZih2bS5zZWxlY3RlZENhdHMubGVuZ3RoKSB7XG5cdFx0XHRcdC8vIGdldCBhZ2VudHMgRkNSIG9ubHkgd2l0aCBzZWxlY3RlZCBjYXRlZ29yaWVzXG5cdFx0XHRcdG9wdHMud2hlcmUgKz0gJyBhbmQgJyArIFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJyBpbiAnK2FycmF5VG9Jbih2bS5zZWxlY3RlZENhdHMpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEZDUlN0YXRpc3RpY3Mob3B0cylcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRhZ2VudHNGY3IgPSBhcnJheVRvT2JqZWN0QW5kU3VtKHJlc3VsdC5kYXRhLnJlc3VsdCwgJ2FnZW50Jyk7XG5cdFx0XHRcdHZtLmFnZW50c0ZjciA9IE9iamVjdC5rZXlzKGFnZW50c0ZjcikubWFwKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdHJldHVybiBhZ2VudHNGY3Jba2V5XTtcblx0XHRcdFx0fSlcblx0XHRcdFx0Lm1hcChjb3VudEZjcik7XG5cblx0XHRcdFx0dm0udG90YWxBZ2VudHNGY3IgPSB2bS5hZ2VudHNGY3IubGVuZ3RoID8gdm0uYWdlbnRzRmNyLnJlZHVjZShzdW1PYmplY3RzKSA6IFtdO1xuXG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2FnZW50cy1mY3ItbG9hZGVyJyk7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0QWdlbnRGY3I6ICcsIHZtLmFnZW50c0Zjcik7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDYXRGY3IoKSB7XG5cdFx0XHRcblx0XHRcdGlmKCF2bS5zZWxlY3RlZENhdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzLFxuXHRcdFx0XHRwYXJhbXMgPSB7XG5cdFx0XHRcdFx0dGFzazogdm0uc2VsZWN0ZWRUYXNrc1swXSxcblx0XHRcdFx0XHR0YWJsZTogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lXSxcblx0XHRcdFx0XHR3aGVyZTogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpICtcblx0XHRcdFx0XHRcdFx0JyBhbmQgJyArIFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSArXG5cdFx0XHRcdFx0XHRcdCcgYW5kICcgKyBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKycgaW4gJythcnJheVRvSW4odm0uc2VsZWN0ZWRDYXRzKSArXG5cdFx0XHRcdFx0XHRcdCcgYW5kICcgKyBbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKycgaW4gJythcnJheVRvSW4odm0uc2VsZWN0ZWRTdWJjYXRzKSxcblx0XHRcdFx0XHRwcm9jaWQ6IHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWQsXG5cdFx0XHRcdFx0Y29sdW1uOiBbdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdFx0aW50ZXJ2YWw6IGRlZmF1bHRPcHRpb25zLmludGVydmFsLFxuXHRcdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpXG5cdFx0XHRcdH07XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdC1mY3ItbG9hZGVyJyk7XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tRkNSU3RhdGlzdGljcyhwYXJhbXMpXG5cdFx0XHQudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0Y2F0RmNyID0gYXJyYXlUb09iamVjdEFuZFN1bShyZXN1bHQuZGF0YS5yZXN1bHQsICdjYXRkZXNjJyk7XG5cdFx0XHRcdHZtLmNhdEZjciA9IE9iamVjdC5rZXlzKGNhdEZjcilcblx0XHRcdFx0Lm1hcChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0XHRyZXR1cm4gY2F0RmNyW2tleV07XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5tYXAoY291bnRGY3IpO1xuXG5cdFx0XHRcdHZtLnRvdGFsQ2F0RmNyID0gdm0uY2F0RmNyLmxlbmd0aCA/IHZtLmNhdEZjci5yZWR1Y2Uoc3VtT2JqZWN0cykgOiBbXTtcblxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXQtZmNyLWxvYWRlcicpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhdEZjcjogJywgdm0uY2F0RmNyLCB2bS50b3RhbENhdEZjcik7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdWJjYXRGY3IoKSB7XG5cdFx0XHQvLyBzcGlubmVyU2VydmljZS5zaG93KCdmY3ItbG9hZGVyJyk7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXG5cdFx0XHRpZih2bS5zZWxlY3RlZENhdCA9PT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY2F0LWZjci1sb2FkZXInKTtcblxuXHRcdFx0cmV0dXJuIGFwaS5nZXRDdXN0b21GQ1JTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFzazogdm0uc2VsZWN0ZWRUYXNrc1swXSxcblx0XHRcdFx0dGFibGU6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZV0sXG5cdFx0XHRcdHdoZXJlOiBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0uam9pbignLicpICsgJz1cXCcnICsgdm0uc2VsZWN0ZWRDYXQgKyAnXFwnIGFuZCAnICtcblx0XHRcdFx0XHRcdFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSArICcgYW5kICcgK1xuXHRcdFx0XHRcdFx0W3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpICtcblx0XHRcdFx0XHRcdCcgYW5kICcgKyBbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKycgaW4gJythcnJheVRvSW4odm0uc2VsZWN0ZWRTdWJjYXRzKSxcblx0XHRcdFx0cHJvY2lkOiB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkLFxuXHRcdFx0XHRjb2x1bW46IFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0aW50ZXJ2YWw6IGRlZmF1bHRPcHRpb25zLmludGVydmFsLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0c3ViY2F0RmNyID0gYXJyYXlUb09iamVjdEFuZFN1bShyZXN1bHQuZGF0YS5yZXN1bHQsICdwcm9iZGVzYycpO1xuXHRcdFx0XHR2bS5zdWJjYXRGY3IgPSBPYmplY3Qua2V5cyhzdWJjYXRGY3IpXG5cdFx0XHRcdC5tYXAoZnVuY3Rpb24oa2V5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHN1YmNhdEZjcltrZXldO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQubWFwKGNvdW50RmNyKTtcblxuXHRcdFx0XHR2bS50b3RhbFN1YmNhdEZjciA9IHZtLnN1YmNhdEZjci5yZWR1Y2Uoc3VtT2JqZWN0cyk7XG5cblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY2F0LWZjci1sb2FkZXInKTtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRTdWJjYXRGY3I6ICcsIHZtLnN1YmNhdEZjciwgdm0udG90YWxTdWJjYXRGY3IpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25DYXRTZWxlY3QoY2F0KSB7XG5cdFx0XHRkZWJ1Zy5sb2coJ29uQ2F0U2VsZWN0OiAnLCBjYXQpO1xuXHRcdFx0dm0uc2VsZWN0ZWRDYXQgPSBjYXQ7XG5cdFx0XHRcblx0XHRcdGdldEFnZW50RmNyKClcblx0XHRcdC50aGVuKGdldFN1YmNhdEZjcik7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25TdWJjYXRTZWxlY3Qoc3ViY2F0KSB7XG5cdFx0XHRkZWJ1Zy5sb2coJ29uU3ViY2F0U2VsZWN0OiAnLCBzdWJjYXQpO1xuXHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXQgPSBzdWJjYXQ7XG5cdFx0XHRnZXRBZ2VudEZjcigpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNvdW50RmNyKG9iaikge1xuXHRcdFx0b2JqLmZjclJhdGUgPSBvYmouZmNyIC8gb2JqLnRvdGFsICogMTAwO1xuXHRcdFx0cmV0dXJuIG9ialxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFycmF5VG9PYmplY3RBbmRTdW0oYXJyYXksIHByb3BOYW1lKSB7XG5cdFx0XHRpZighYXJyYXkubGVuZ3RoKSByZXR1cm4gYXJyYXk7XG5cblx0XHRcdHJldHVybiBhcnJheS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgbmV4dCkge1xuXHRcdFx0XHRpZihuZXh0Lmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuXHRcdFx0XHRcdHByZXZbbmV4dFtwcm9wTmFtZV1dID0gcHJldltuZXh0W3Byb3BOYW1lXV0gPyBzdW1PYmplY3RzKG5leHQsIHByZXZbbmV4dFtwcm9wTmFtZV1dKSA6IG5leHQ7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHt9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhcnJheVRvSW4oYXJyYXkpIHtcblx0XHRcdHJldHVybiAnKFwiJyArIGFycmF5LmpvaW4oJ1wiLFwiJykgKyAnXCIpJztcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdW1PYmplY3RzKCkge1xuXHRcdFx0dmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cdFx0XHR2YXIgc3VtID0ge307XG5cblx0XHRcdHJldHVybiBhcmdzLnJlZHVjZShmdW5jdGlvbih0b3RhbCwgbmV4dCkge1xuXG5cdFx0XHRcdE9iamVjdC5rZXlzKG5leHQpXG5cdFx0XHRcdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdGlmKHR5cGVvZiBuZXh0W2tleV0gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHR0b3RhbFtrZXldID0gdG90YWxba2V5XSA/IHRvdGFsW2tleV0gKyBuZXh0W2tleV0gOiBuZXh0W2tleV07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvdGFsW2tleV0gPSBuZXh0W2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gdG90YWw7XG5cblx0XHRcdH0sIHN1bSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmZjcicpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2ZjcicsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnZmNyL2Zjci5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdGY3JDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2ZjclZtJ1xuXHRcdH0pO1xufV0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAnKVxuLmZpbHRlcignY29udmVydEJ5dGVzJywgZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbihpbnRlZ2VyLCBmcm9tVW5pdHMsIHRvVW5pdHMpIHtcbiAgICB2YXIgY29lZmZpY2llbnRzID0ge1xuICAgICAgICAnQnl0ZSc6IDEsXG4gICAgICAgICdLQic6IDEwMDAsXG4gICAgICAgICdNQic6IDEwMDAwMDAsXG4gICAgICAgICdHQic6IDEwMDAwMDAwMDBcbiAgICB9O1xuICAgIHJldHVybiBpbnRlZ2VyICogY29lZmZpY2llbnRzW2Zyb21Vbml0c10gLyBjb2VmZmljaWVudHNbdG9Vbml0c107XG4gIH07XG59KVxuLmZpbHRlcignYXZlcmFnZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24odmFsdWUsIG51bWJlcikge1xuXHRcdGlmKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblx0XHRcblx0XHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSkgLyAobnVtYmVyIHx8IDEpO1xuXHR9O1xufSlcbi5maWx0ZXIoJ3RpbWVyJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgZnJhY3Rpb24pIHtcblx0XHRpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cdFx0XG5cdFx0dmFyIGZpbHRlcmVkID0gcGFyc2VGbG9hdCh2YWx1ZSksXG5cdFx0XHRoaCA9IDAsIG1tID0gMCwgc3MgPSAwO1xuXG5cdFx0ZnVuY3Rpb24gcHJlcGFyZShudW1iZXIpe1xuXHRcdFx0cmV0dXJuIE1hdGguZmxvb3IobnVtYmVyKSA+IDkgPyBNYXRoLmZsb29yKG51bWJlcikgOiAnMCcrTWF0aC5mbG9vcihudW1iZXIpO1xuXHRcdH1cblxuXHRcdGhoID0gZmlsdGVyZWQgLyAzNjAwO1xuXHRcdG1tID0gKGZpbHRlcmVkICUgMzYwMCkgLyA2MDtcblx0XHRzcyA9IChtbSAlIDEpLzEwMCo2MCoxMDA7XG5cblx0XHRyZXR1cm4gcHJlcGFyZShoaCkrJzonK3ByZXBhcmUobW0pKyc6JytwcmVwYXJlKHNzKTtcblx0fTtcbn0pXG4uZmlsdGVyKCdkdXJhdGlvbicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24odmFsdWUsIGZyYWN0aW9uKSB7XG5cdFx0aWYodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXHRcdFxuXHRcdHZhciBmaWx0ZXJlZCA9IHBhcnNlRmxvYXQodmFsdWUpLFxuXHRcdFx0cHJlZml4ID0gJ3MnO1xuXG5cdFx0aWYoZmlsdGVyZWQgPiAzNjAwKSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkIC8gMzYwMDtcblx0XHRcdHByZWZpeCA9ICdoJztcblx0XHR9IGVsc2UgaWYoZmlsdGVyZWQgPiA2MCkge1xuXHRcdFx0ZmlsdGVyZWQgPSBmaWx0ZXJlZCAvIDYwO1xuXHRcdFx0cHJlZml4ID0gJ20nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyZWQudG9GaXhlZChmcmFjdGlvbiB8fCAyKSArICcgJyArIHByZWZpeDtcblx0fTtcbn0pXG4uZmlsdGVyKCdkaWZmJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihwcmV2dmFsdWUsIG5leHR2YWx1ZSwgdW5pdCkge1xuXHRcdGlmKHByZXZ2YWx1ZSA9PT0gdW5kZWZpbmVkICYmIG5leHR2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cblx0XHR2YXIgaW50UHJldlZhbHVlID0gcHJldnZhbHVlID8gcGFyc2VGbG9hdChwcmV2dmFsdWUpIDogMCxcblx0XHRcdGludE5leHRWYWx1ZSA9IG5leHR2YWx1ZSA/IHBhcnNlRmxvYXQobmV4dHZhbHVlKSA6IDAsXG5cdFx0XHRmaWx0ZXJlZCwgZGlmZiwgcHJlZml4ID0gJysnLCBkeW5hbWljcyA9IHRydWU7XG5cblx0XHRpZihpbnRQcmV2VmFsdWUgPiBpbnROZXh0VmFsdWUpIHtcblx0XHRcdGRpZmYgPSBpbnRQcmV2VmFsdWUgLSBpbnROZXh0VmFsdWU7XG5cdFx0XHRmaWx0ZXJlZCA9IGRpZmYgKiAxMDAgLyBpbnRQcmV2VmFsdWU7XG5cdFx0XHRwcmVmaXggPSAnLSc7XG5cdFx0XHRkeW5hbWljcyA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaWZmID0gaW50TmV4dFZhbHVlIC0gaW50UHJldlZhbHVlO1xuXHRcdFx0ZmlsdGVyZWQgPSBkaWZmICogMTAwIC8gaW50TmV4dFZhbHVlO1xuXHRcdH1cblxuXHRcdGlmKHVuaXQgPT09ICd2YWx1ZScpIHtcblx0XHRcdHJldHVybiBwcmVmaXgrZGlmZjtcblx0XHR9IGVsc2UgaWYodW5pdCA9PT0gJ2R5bmFtaWNzJykge1xuXHRcdFx0cmV0dXJuIGR5bmFtaWNzO1xuXHRcdH0gZWxzZSBpZih1bml0ID09PSAnZHluYW1pY3MtcmV2ZXJzZScpIHtcblx0XHRcdHJldHVybiAhZHluYW1pY3M7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBwcmVmaXgrZmlsdGVyZWQudG9GaXhlZCgxKSsnJSc7XG5cdFx0fVxuXHR9O1xufSlcbi5maWx0ZXIoJ2R5bmFtaWNzJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZTEsIHZhbHVlMikge1xuXHRcdGlmKHZhbHVlMSA9PT0gdW5kZWZpbmVkICYmIHZhbHVlMiA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cblx0XHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZTEpID4gcGFyc2VGbG9hdCh2YWx1ZTIpID8gJ3Bvc2l0aXZlJyA6ICduZWdhdGl2ZSc7XG5cdH07XG59KTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdMYXlvdXRDb250cm9sbGVyJywgTGF5b3V0Q29udHJvbGxlcik7XG5cblx0TGF5b3V0Q29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJ107XG5cblx0ZnVuY3Rpb24gTGF5b3V0Q29udHJvbGxlcigkcm9vdFNjb3BlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0XG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2FwaVNlcnZpY2UnLCBhcGlTZXJ2aWNlKTtcblxuICAgIGFwaVNlcnZpY2UuJGluamVjdCA9IFsnJGh0dHAnLCAnYXBwQ29uZmlnJywgJ2Vycm9yU2VydmljZScsICdkZWJ1Z1NlcnZpY2UnXTtcblxuICAgIGZ1bmN0aW9uIGFwaVNlcnZpY2UoJGh0dHAsIGFwcENvbmZpZywgZXJyb3JTZXJ2aWNlLCBkZWJ1Zyl7XG5cbiAgICAgICAgdmFyIGJhc2VVcmwgPSBhcHBDb25maWcuc2VydmVyO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXREYlNldHRpbmdzOiBnZXREYlNldHRpbmdzLFxuICAgICAgICAgICAgZ2V0VGFza3M6IGdldFRhc2tzLFxuICAgICAgICAgICAgZ2V0RkNSU3RhdGlzdGljczogZ2V0RkNSU3RhdGlzdGljcyxcbiAgICAgICAgICAgIGdldEN1c3RvbUZDUlN0YXRpc3RpY3M6IGdldEN1c3RvbUZDUlN0YXRpc3RpY3MsXG4gICAgICAgICAgICBnZXRUYXNrR3JvdXBTdGF0aXN0aWNzOiBnZXRUYXNrR3JvdXBTdGF0aXN0aWNzLFxuICAgICAgICAgICAgZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3M6IGdldEN1c3RvbUxpc3RTdGF0aXN0aWNzLFxuICAgICAgICAgICAgZ2V0UXVlcnlSZXN1bHRTZXQ6IGdldFF1ZXJ5UmVzdWx0U2V0XG5cbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBnZXREYlNldHRpbmdzKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3N0YXQvZGIuanNvbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VGFza3MocGFyYW1zLCBjYikge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRUYXNrcycsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdChiYXNlVXJsLCByZXFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RkNSU3RhdGlzdGljcyhwYXJhbXMsIGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldEZDUlN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEN1c3RvbUZDUlN0YXRpc3RpY3MocGFyYW1zLCBjYikge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRDdXN0b21GQ1JTdGF0aXN0aWNzJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7ICAgXG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrR3JvdXBTdGF0aXN0aWNzKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRUYXNrR3JvdXBTdGF0aXN0aWNzJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDdXN0b21MaXN0U3RhdGlzdGljcyhwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciByZXFQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFF1ZXJ5UmVzdWx0U2V0KHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIFNFTEVDVCA9ICdTRUxFQ1QgJyArIHBhcmFtcy5jb2x1bW5zO1xuICAgICAgICAgICAgdmFyIEZST00gPSAnRlJPTSAnICsgcGFyYW1zLnRhYmxlcztcbiAgICAgICAgICAgIHZhciBXSEVSRSA9IChwYXJhbXMudGFicmVsIHx8IHBhcmFtcy5iZWdpbikgPyAnV0hFUkUgJyA6ICcnO1xuICAgICAgICAgICAgdmFyIEdST1VQQlkgPSBwYXJhbXMuZ3JvdXBCeSA/ICgnR1JPVVAgQlkgJyArIHBhcmFtcy5ncm91cEJ5KSA6ICcnO1xuXG4gICAgICAgICAgICBXSEVSRSArPSBwYXJhbXMudGFicmVsID8gcGFyYW1zLnRhYnJlbCA6ICcnO1xuICAgICAgICAgICAgV0hFUkUgKz0gcGFyYW1zLmJlZ2luID8gXG4gICAgICAgICAgICAgICAgICAgICggKFdIRVJFID8gJyBhbmQgJyA6ICcnKSArICd0aW1lc3RhcnQgYmV0d2VlbiAnICsgbW9tZW50KHBhcmFtcy5iZWdpbikudW5peCgpICsgJyBhbmQgJyArIG1vbWVudChwYXJhbXMuZW5kKS51bml4KCkgKSA6ICcnO1xuXG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFF1ZXJ5UmVzdWx0U2V0JyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnk6IFtTRUxFQ1QsIEZST00sIFdIRVJFLCBHUk9VUEJZXS5qb2luKCcgJylcbiAgICAgICAgICAgICAgICAgICAgLy8gcXVlcnk6IFsnU0VMRUNUJywgcGFyYW1zLmNvbHVtbnMsICdGUk9NJywgcGFyYW1zLnRhYmxlcywgJ1dIRVJFJywgJ3Byb2Nlc3NlZC5wcm9jaWQ9JytwYXJhbXMucHJvY2lkLCAnYW5kJywgcGFyYW1zLnRhYnJlbCwgJ2FuZCB0aW1lc3RhcnQgYmV0d2VlbicsIG1vbWVudChwYXJhbXMuYmVnaW4pLnVuaXgoKSwgJ2FuZCcsIG1vbWVudChwYXJhbXMuZW5kKS51bml4KCksIChwYXJhbXMuZ3JvdXBCeSA/ICdncm91cCBieSAnK3BhcmFtcy5ncm91cEJ5IDogJycpXS5qb2luKCcgJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnY2hhcnRTZXJ2aWNlJywgY2hhcnRTZXJ2aWNlKTtcblxuICAgIGNoYXJ0U2VydmljZS4kaW5qZWN0ID0gWyd1dGlsc1NlcnZpY2UnLCAnY29sb3VyR2VuZXJhdG9yJywgJ3N0b3JlJ107XG5cbiAgICBmdW5jdGlvbiBjaGFydFNlcnZpY2UodXRpbHNTZXJ2aWNlLCBjb2xvdXJHZW5lcmF0b3IsIHN0b3JlKXtcblxuICAgICAgICB2YXIgdXNlZENvbG91cnMgPSBzdG9yZS5nZXQoJ2NvbG91cnMnKSB8fCBbXTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2V0Q2hhcnREYXRhOiBzZXRDaGFydERhdGEsXG4gICAgICAgICAgICBnZXRDaGFydENvbG91cjogZ2V0Q2hhcnRDb2xvdXJcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBzZXRDaGFydERhdGEoYXJyYXksIGRhdGFrZXksIGxhYmVsa2V5LCBvcmRlckJ5KXtcbiAgICAgICAgICAgIHZhciBkYXRhID0gW10sIGxhYmVscyA9IFtdLCBjb2xvdXJzID0gW107XG5cbiAgICAgICAgICAgIGlmKG9yZGVyQnkpIFxuICAgICAgICAgICAgICAgIGFycmF5ID0gdXRpbHNTZXJ2aWNlLnNvcnRPYmpCeShhcnJheSwgb3JkZXJCeSwgJ2Rlc2NlbmQnKTtcblxuICAgICAgICAgICAgYXJyYXlcbiAgICAgICAgICAgIC5tYXAoZnVuY3Rpb24oaXRlbSl7XG4gICAgICAgICAgICAgICAgZGF0YS5wdXNoKGFuZ3VsYXIuaXNOdW1iZXIoaXRlbVtkYXRha2V5XSkgPyBwYXJzZUZsb2F0KGl0ZW1bZGF0YWtleV0udG9GaXhlZCgyKSkgOiBpdGVtW2RhdGFrZXldICk7XG4gICAgICAgICAgICAgICAgbGFiZWxzLnB1c2goaXRlbVtsYWJlbGtleV0pO1xuICAgICAgICAgICAgICAgIGNvbG91cnMucHVzaChnZXRDaGFydENvbG91cihpdGVtW2xhYmVsa2V5XSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIGxhYmVsczogbGFiZWxzLFxuICAgICAgICAgICAgICAgIGNvbG91cnM6IGNvbG91cnNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDaGFydENvbG91cihjYXQpe1xuICAgICAgICAgICAgdmFyIGZvdW5kID0gZmFsc2UsIGNvbG91ciA9ICcnO1xuXG4gICAgICAgICAgICB1c2VkQ29sb3Vycy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pe1xuICAgICAgICAgICAgICAgIGlmKGl0ZW0ubmFtZSA9PT0gY2F0KSBmb3VuZCA9IGl0ZW07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYoZm91bmQpIHtcbiAgICAgICAgICAgICAgICBjb2xvdXIgPSBmb3VuZC5jb2xvdXI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbG91ciA9IGNvbG91ckdlbmVyYXRvci5nZXRDb2xvcigpO1xuICAgICAgICAgICAgICAgIHVzZWRDb2xvdXJzLnB1c2goeyBuYW1lOiBjYXQsIGNvbG91cjogY29sb3VyIH0pO1xuICAgICAgICAgICAgICAgIHN0b3JlLnNldCgnY29sb3VycycsIHVzZWRDb2xvdXJzKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNvbG91cjtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnY29sb3VyR2VuZXJhdG9yJywgY29sb3VyR2VuZXJhdG9yKTtcblxuICAgIGZ1bmN0aW9uIGNvbG91ckdlbmVyYXRvcigpe1xuXG4gICAgICAgIC8vIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL3JhbmRvbS1tYXRlcmlhbC1jb2xvclxuXG4gICAgICAgIHZhciBkZWZhdWx0UGFsZXR0ZSA9IHtcbiAgICAgICAgICAgIC8vIFJlZCwgUGluaywgUHVycGxlLCBEZWVwIFB1cnBsZSwgSW5kaWdvLCBCbHVlLCBMaWdodCBCbHVlLCBDeWFuLCBUZWFsLCBHcmVlbiwgTGlnaHQgR3JlZW4sIExpbWUsIFllbGxvdywgQW1iZXIsIE9yYW5nZSwgRGVlcCBPcmFuZ2UsIEJyb3duLCBHcmV5LCBCbHVlIEdyZXlcbiAgICAgICAgICAgICc1MCc6IFsnI0ZGRUJFRScsICcjRkNFNEVDJywgJyNGM0U1RjUnLCAnI0VERTdGNicsICcjRThFQUY2JywgJyNFM0YyRkQnLCAnI0UxRjVGRScsICcjRTBGN0ZBJywgJyNFMEYyRjEnLCAnI0U4RjVFOScsICcjRjFGOEU5JywgJyNGOUZCRTcnLCAnI0ZGRkRFNycsICcjRkZGOEUxJywgJyNGRkYzRTAnLCAnI0ZCRTlFNycsICcjRUZFQkU5JywgJyNGQUZBRkEnLCAnI0VDRUZGMSddLFxuICAgICAgICAgICAgJzEwMCc6IFsnI0ZGQ0REMicsICcjRjhCQkQwJywgJyNFMUJFRTcnLCAnI0QxQzRFOScsICcjQzVDQUU5JywgJyNCQkRFRkInLCAnI0IzRTVGQycsICcjQjJFQkYyJywgJyNCMkRGREInLCAnI0M4RTZDOScsICcjRENFREM4JywgJyNGMEY0QzMnLCAnI0ZGRjlDNCcsICcjRkZFQ0IzJywgJyNGRkUwQjInLCAnI0ZGQ0NCQycsICcjRDdDQ0M4JywgJyNGNUY1RjUnLCAnI0NGRDhEQyddLFxuICAgICAgICAgICAgJzIwMCc6IFsnI0VGOUE5QScsICcjRjQ4RkIxJywgJyNDRTkzRDgnLCAnI0IzOUREQicsICcjOUZBOERBJywgJyM5MENBRjknLCAnIzgxRDRGQScsICcjODBERUVBJywgJyM4MENCQzQnLCAnI0E1RDZBNycsICcjQzVFMUE1JywgJyNFNkVFOUMnLCAnI0ZGRjU5RCcsICcjRkZFMDgyJywgJyNGRkNDODAnLCAnI0ZGQUI5MScsICcjQkNBQUE0JywgJyNFRUVFRUUnLCAnI0IwQkVDNSddLFxuICAgICAgICAgICAgJzMwMCc6IFsnI0U1NzM3MycsICcjRjA2MjkyJywgJyNCQTY4QzgnLCAnIzk1NzVDRCcsICcjNzk4NkNCJywgJyM2NEI1RjYnLCAnIzRGQzNGNycsICcjNEREMEUxJywgJyM0REI2QUMnLCAnIzgxQzc4NCcsICcjQUVENTgxJywgJyNEQ0U3NzUnLCAnI0ZGRjE3NicsICcjRkZENTRGJywgJyNGRkI3NEQnLCAnI0ZGOEE2NScsICcjQTE4ODdGJywgJyNFMEUwRTAnLCAnIzkwQTRBRSddLFxuICAgICAgICAgICAgJzQwMCc6IFsnI0VGNTM1MCcsICcjRUM0MDdBJywgJyNBQjQ3QkMnLCAnIzdFNTdDMicsICcjNUM2QkMwJywgJyM0MkE1RjUnLCAnIzI5QjZGNicsICcjMjZDNkRBJywgJyMyNkE2OUEnLCAnIzY2QkI2QScsICcjOUNDQzY1JywgJyNENEUxNTcnLCAnI0ZGRUU1OCcsICcjRkZDQTI4JywgJyNGRkE3MjYnLCAnI0ZGNzA0MycsICcjOEQ2RTYzJywgJyNCREJEQkQnLCAnIzc4OTA5QyddLFxuICAgICAgICAgICAgJzUwMCc6IFsnI0Y0NDMzNicsICcjRTkxRTYzJywgJyM5QzI3QjAnLCAnIzY3M0FCNycsICcjM0Y1MUI1JywgJyMyMTk2RjMnLCAnIzAzQTlGNCcsICcjMDBCQ0Q0JywgJyMwMDk2ODgnLCAnIzRDQUY1MCcsICcjOEJDMzRBJywgJyNDRERDMzknLCAnI0ZGRUIzQicsICcjRkZDMTA3JywgJyNGRjk4MDAnLCAnI0ZGNTcyMicsICcjNzk1NTQ4JywgJyM5RTlFOUUnLCAnIzYwN0Q4QiddLFxuICAgICAgICAgICAgJzYwMCc6IFsnI0U1MzkzNScsICcjRDgxQjYwJywgJyM4RTI0QUEnLCAnIzVFMzVCMScsICcjMzk0OUFCJywgJyMxRTg4RTUnLCAnIzAzOUJFNScsICcjMDBBQ0MxJywgJyMwMDg5N0InLCAnIzQzQTA0NycsICcjN0NCMzQyJywgJyNDMENBMzMnLCAnI0ZERDgzNScsICcjRkZCMzAwJywgJyNGQjhDMDAnLCAnI0Y0NTExRScsICcjNkQ0QzQxJywgJyM3NTc1NzUnLCAnIzU0NkU3QSddLFxuICAgICAgICAgICAgJzcwMCc6IFsnI0QzMkYyRicsICcjQzIxODVCJywgJyM3QjFGQTInLCAnIzUxMkRBOCcsICcjMzAzRjlGJywgJyMxOTc2RDInLCAnIzAyODhEMScsICcjMDA5N0E3JywgJyMwMDc5NkInLCAnIzM4OEUzQycsICcjNjg5RjM4JywgJyNBRkI0MkInLCAnI0ZCQzAyRCcsICcjRkZBMDAwJywgJyNGNTdDMDAnLCAnI0U2NEExOScsICcjNUQ0MDM3JywgJyM2MTYxNjEnLCAnIzQ1NUE2NCddLFxuICAgICAgICAgICAgJzgwMCc6IFsnI0M2MjgyOCcsICcjQUQxNDU3JywgJyM2QTFCOUEnLCAnIzQ1MjdBMCcsICcjMjgzNTkzJywgJyMxNTY1QzAnLCAnIzAyNzdCRCcsICcjMDA4MzhGJywgJyMwMDY5NUMnLCAnIzJFN0QzMicsICcjNTU4QjJGJywgJyM5RTlEMjQnLCAnI0Y5QTgyNScsICcjRkY4RjAwJywgJyNFRjZDMDAnLCAnI0Q4NDMxNScsICcjNEUzNDJFJywgJyM0MjQyNDInLCAnIzM3NDc0RiddLFxuICAgICAgICAgICAgJzkwMCc6IFsnI0I3MUMxQycsICcjODgwRTRGJywgJyM0QTE0OEMnLCAnIzMxMUI5MicsICcjMUEyMzdFJywgJyMwRDQ3QTEnLCAnIzAxNTc5QicsICcjMDA2MDY0JywgJyMwMDRENDAnLCAnIzFCNUUyMCcsICcjMzM2OTFFJywgJyM4Mjc3MTcnLCAnI0Y1N0YxNycsICcjRkY2RjAwJywgJyNFNjUxMDAnLCAnI0JGMzYwQycsICcjM0UyNzIzJywgJyMyMTIxMjEnLCAnIzI2MzIzOCddLFxuICAgICAgICAgICAgJ0ExMDAnOiBbJyNGRjhBODAnLCAnI0ZGODBBQicsICcjRUE4MEZDJywgJyNCMzg4RkYnLCAnIzhDOUVGRicsICcjODJCMUZGJywgJyM4MEQ4RkYnLCAnIzg0RkZGRicsICcjQTdGRkVCJywgJyNCOUY2Q0EnLCAnI0NDRkY5MCcsICcjRjRGRjgxJywgJyNGRkZGOEQnLCAnI0ZGRTU3RicsICcjRkZEMTgwJywgJyNGRjlFODAnXSxcbiAgICAgICAgICAgICdBMjAwJzogWycjRkY1MjUyJywgJyNGRjQwODEnLCAnI0UwNDBGQicsICcjN0M0REZGJywgJyM1MzZERkUnLCAnIzQ0OEFGRicsICcjNDBDNEZGJywgJyMxOEZGRkYnLCAnIzY0RkZEQScsICcjNjlGMEFFJywgJyNCMkZGNTknLCAnI0VFRkY0MScsICcjRkZGRjAwJywgJyNGRkQ3NDAnLCAnI0ZGQUI0MCcsICcjRkY2RTQwJ10sXG4gICAgICAgICAgICAnQTQwMCc6IFsnI0ZGMTc0NCcsICcjRjUwMDU3JywgJyNENTAwRjknLCAnIzY1MUZGRicsICcjM0Q1QUZFJywgJyMyOTc5RkYnLCAnIzAwQjBGRicsICcjMDBFNUZGJywgJyMxREU5QjYnLCAnIzAwRTY3NicsICcjNzZGRjAzJywgJyNDNkZGMDAnLCAnI0ZGRUEwMCcsICcjRkZDNDAwJywgJyNGRjkxMDAnLCAnI0ZGM0QwMCddLFxuICAgICAgICAgICAgJ0E3MDAnOiBbJyNENTAwMDAnLCAnI0M1MTE2MicsICcjQUEwMEZGJywgJyM2MjAwRUEnLCAnIzMwNEZGRScsICcjMjk2MkZGJywgJyMwMDkxRUEnLCAnIzAwQjhENCcsICcjMDBCRkE1JywgJyMwMEM4NTMnLCAnIzY0REQxNycsICcjQUVFQTAwJywgJyNGRkQ2MDAnLCAnI0ZGQUIwMCcsICcjRkY2RDAwJywgJyNERDJDMDAnXVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qIHVzZWRDb2xvcnMgPSBbeyB0ZXh0OlNvbWVUZXh0LCBjb2xvcjogU29tZUNvbG9yIH1dICovXG4gICAgICAgIHZhciB1c2VkQ29sb3JzID0gW107XG4gICAgICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHNoYWRlczogWyc1MCcsICcxMDAnLCAnMjAwJywgJzMwMCcsICc0MDAnLCAnNTAwJywgJzYwMCcsICc3MDAnLCAnODAwJywgJzkwMCcsICdBMTAwJywgJ0EyMDAnLCAnQTQwMCcsICdBNzAwJ10sXG4gICAgICAgICAgICBwYWxldHRlOiBkZWZhdWx0UGFsZXR0ZSxcbiAgICAgICAgICAgIHRleHQ6IG51bGwsXG4gICAgICAgICAgICBpZ25vcmVDb2xvcnM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldENvbG9yOiBnZXRDb2xvclxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldENvbG9yKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgICAgICBvcHRpb25zLnBhbGV0dGUgfHwgKG9wdGlvbnMucGFsZXR0ZSA9IGRlZmF1bHRQYWxldHRlKTtcbiAgICAgICAgICAgIG9wdGlvbnMuc2hhZGVzIHx8IChvcHRpb25zLnNoYWRlcyA9IFsnNTAwJ10pO1xuXG4gICAgICAgICAgICB2YXIgbCA9IHVzZWRDb2xvcnMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGNvbG9yO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnRleHQgJiYgdXNlZENvbG9yc1tpXS50ZXh0ID09PSBvcHRpb25zLnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVzZWRDb2xvcnNbaV0uY29sb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb2xvciA9IHBpY2tDb2xvcihvcHRpb25zKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudGV4dCkge1xuICAgICAgICAgICAgICAgIHVzZWRDb2xvcnMucHVzaCh7dGV4dDogb3B0aW9ucy50ZXh0LCBjb2xvcjogY29sb3J9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbG9yO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcGlja0NvbG9yKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzaGFkZSA9IG9wdGlvbnMuc2hhZGVzW2dldFJhbmRvbUludChvcHRpb25zLnNoYWRlcy5sZW5ndGgpXTtcbiAgICAgICAgICAgIHZhciBjb2xvciA9ICcnO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucy5wYWxldHRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucGFsZXR0ZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleSA9PT0gc2hhZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3IgPSBvcHRpb25zLnBhbGV0dGVba2V5XVtnZXRSYW5kb21JbnQob3B0aW9ucy5wYWxldHRlW2tleV0ubGVuZ3RoKV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29sb3I7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRSYW5kb21JbnQobWF4KSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCkpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdkZWJ1Z1NlcnZpY2UnLCBkZWJ1Z1NlcnZpY2UpO1xuXG4gICAgZGVidWdTZXJ2aWNlLiRpbmplY3QgPSBbJyRsb2cnLCAnc3RvcmUnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBkZWJ1Z1NlcnZpY2UoJGxvZywgc3RvcmUsIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxvZzogZnVuY3Rpb24obWVzc2FnZSl7IGxvZyhhcmd1bWVudHMsICdsb2cnKTsgfSxcbiAgICAgICAgICAgIGluZm86IGZ1bmN0aW9uKG1lc3NhZ2UpeyBsb2coYXJndW1lbnRzLCAnaW5mbycpOyB9LFxuICAgICAgICAgICAgd2FybjogZnVuY3Rpb24obWVzc2FnZSl7IGxvZyhhcmd1bWVudHMsICd3YXJuJyk7IH0sXG4gICAgICAgICAgICBlcnJvcjogZXJyb3JTZXJ2aWNlLnNob3dcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBsb2coYXJncywgbWV0aG9kKXtcbiAgICAgICAgICAgIGlmKHN0b3JlLmdldCgnZGVidWcnKSkge1xuICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChhcmdzLCBmdW5jdGlvbihhcmcpe1xuICAgICAgICAgICAgICAgICAgICAkbG9nW21ldGhvZF0oYXJnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2Vycm9yU2VydmljZScsIGVycm9yU2VydmljZSk7XG5cbiAgICBlcnJvclNlcnZpY2UuJGluamVjdCA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZXJyb3JTZXJ2aWNlKCl7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNob3c6IHNob3dcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBzaG93KGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIC8vICR0cmFuc2xhdGUoJ0VSUk9SUy4nK2Vycm9yKVxuICAgICAgICAgICAgLy8gLnRoZW4oZnVuY3Rpb24gKHRyYW5zbGF0aW9uKXtcbiAgICAgICAgICAgIC8vICAgICBpZignRVJST1JTLicrZXJyb3IgPT09IHRyYW5zbGF0aW9uKSB7XG4gICAgICAgICAgICAvLyAgICAgICAgIG5vdGlmaWNhdGlvbnMuc2hvd0Vycm9yKCdFUlJPUl9PQ0NVUlJFRCcpO1xuICAgICAgICAgICAgLy8gICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAgICAgICAgIG5vdGlmaWNhdGlvbnMuc2hvd0Vycm9yKHRyYW5zbGF0aW9uKTtcbiAgICAgICAgICAgIC8vICAgICB9XG4gICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnU2V0dGluZ3NTZXJ2aWNlJywgU2V0dGluZ3NTZXJ2aWNlKTtcblxuICAgIFNldHRpbmdzU2VydmljZS4kaW5qZWN0ID0gWyckcScsICdhcGlTZXJ2aWNlJywgJ2Vycm9yU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gU2V0dGluZ3NTZXJ2aWNlKCRxLCBhcGksIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgdmFyIHNldHRpbmdzID0gbnVsbDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0U2V0dGluZ3M6IGdldFNldHRpbmdzXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBHZXQgREIgc2V0dGluZ3MgZnJvbSBjYWNoZSBvciBKU09OIGZpbGVcbiAgICAgICAgZnVuY3Rpb24gZ2V0U2V0dGluZ3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYoc2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcGkuZ2V0RGJTZXR0aW5ncygpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdzID0gZGJTZXR0aW5ncy5kYXRhO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHNldHRpbmdzKTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpe1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdUYXNrc1NlcnZpY2UnLCBUYXNrc1NlcnZpY2UpO1xuXG4gICAgVGFza3NTZXJ2aWNlLiRpbmplY3QgPSBbJ2FwaVNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBUYXNrc1NlcnZpY2UoYXBpLCBlcnJvclNlcnZpY2Upe1xuXG4gICAgICAgIHZhciB0YXNrcyA9IFtcbiAgICAgICAgICAgIHtuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWVzc2FnaW5nX0NoYXQnLCBraW5kOiA3fSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXV0b2RpYWxfQWdlbnQnLCBraW5kOiAxMjl9XG4gICAgICAgIF07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldFRhc2tzOiBnZXRUYXNrcyxcbiAgICAgICAgICAgIGdldFRhc2tMaXN0OiBnZXRUYXNrTGlzdFxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZ2V0VGFza3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFza3M7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrTGlzdChpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGFwaS5nZXRUYXNrcyh7IGtpbmQ6IGlkIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgndXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKTtcblxuICAgIC8vIHV0aWxzU2VydmljZS4kaW5qZWN0ID0gW107XG5cbiAgICBmdW5jdGlvbiB1dGlsc1NlcnZpY2UoKXtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0VG90YWxzOiBnZXRUb3RhbHMsXG4gICAgICAgICAgICBzZXRQZXJjZW50YWdlVmFsdWVzOiBzZXRQZXJjZW50YWdlVmFsdWVzLFxuICAgICAgICAgICAgZ2V0QWJhbmRvbm1lbnRSYXRlOiBnZXRBYmFuZG9ubWVudFJhdGUsXG4gICAgICAgICAgICBnZXRTbEluZGV4OiBnZXRTbEluZGV4LFxuICAgICAgICAgICAgZ2V0RnJpZW5kbHlLaW5kOiBnZXRGcmllbmRseUtpbmQsXG4gICAgICAgICAgICBleHRlbmRBbmRTdW06IGV4dGVuZEFuZFN1bSxcbiAgICAgICAgICAgIHNvcnRPYmpCeTogc29ydE9iakJ5LFxuICAgICAgICAgICAgcXVlcnlUb09iamVjdDogcXVlcnlUb09iamVjdCxcbiAgICAgICAgICAgIHBlcmlvZFRvUmFuZ2U6IHBlcmlvZFRvUmFuZ2UsXG4gICAgICAgICAgICBmaWx0ZXJCeUtleTogZmlsdGVyQnlLZXksXG4gICAgICAgICAgICBmaWx0ZXJVbmlxdWU6IGZpbHRlclVuaXF1ZVxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRvdGFscyhwcmV2LCBuZXh0KXtcbiAgICAgICAgICAgIHZhciB0b3RhbHMgPSB7fTtcbiAgICAgICAgICAgIGZvcih2YXIga2V5IGluIHByZXYpe1xuICAgICAgICAgICAgICAgIGlmKCFpc05hTihwYXJzZUZsb2F0KHByZXZba2V5XSkpICYmICFpc05hTihwYXJzZUZsb2F0KG5leHRba2V5XSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsc1trZXldID0gcGFyc2VGbG9hdChwcmV2W2tleV0pICsgcGFyc2VGbG9hdChuZXh0W2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0b3RhbHM7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzZXRQZXJjZW50YWdlVmFsdWVzKGRhdGEsIHRvdGFscyl7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIGZvcih2YXIga2V5IGluIGl0ZW0pe1xuICAgICAgICAgICAgICAgICAgICBpZih0b3RhbHMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbVtrZXkrJ19wJ10gPSAoaXRlbVtrZXldIC8gdG90YWxzW2tleV0gKiAxMDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRBYmFuZG9ubWVudFJhdGUobmNvLCBuY2Epe1xuICAgICAgICAgICAgcmV0dXJuIG5jYSAqIDEwMCAvIG5jbztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFNsSW5kZXgoYXJyYXkpe1xuICAgICAgICAgICAgdmFyIGluZGV4ID0gLTE7XG4gICAgICAgICAgICBhcnJheS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcbiAgICAgICAgICAgICAgICBpZigvXnNsLy50ZXN0KGl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBpbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEZyaWVuZGx5S2luZChraW5kKXtcbiAgICAgICAgICAgIHZhciBma2luZCA9ICcnO1xuICAgICAgICAgICAgc3dpdGNoIChraW5kKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICBma2luZCA9ICdJbmNvbWluZ19BZ2VudCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgNzpcbiAgICAgICAgICAgICAgICAgICAgZmtpbmQgPSAnTWVzc2FnaW5nX0NoYXQnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDEyOTpcbiAgICAgICAgICAgICAgICAgICAgZmtpbmQgPSAnQXV0b2RpYWxfQWdlbnQnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBma2luZCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBma2luZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGV4dGVuZEFuZFN1bShvYmoxLCBvYmoyLCBpbmRleCwgYXJyYXkpe1xuICAgICAgICAgICAgdmFyIGtleSwgdmFsMSwgdmFsMjtcbiAgICAgICAgICAgIGZvcigga2V5IGluIG9iajIgKSB7XG4gICAgICAgICAgICAgICAgaWYoIG9iajIuaGFzT3duUHJvcGVydHkoIGtleSApICkge1xuICAgICAgICAgICAgICAgICAgICB2YWwxID0gYW5ndWxhci5pc1VuZGVmaW5lZChvYmoxW2tleV0pID8gMCA6IG9iajFba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgdmFsMiA9IGFuZ3VsYXIuaXNVbmRlZmluZWQob2JqMltrZXldKSA/IDAgOiBwYXJzZUZsb2F0KG9iajJba2V5XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmKCFpc05hTih2YWwyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY291bnQgc3VtIGFuZCBmaW5kIGF2ZXJhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iajFba2V5XSA9IGFuZ3VsYXIuaXNOdW1iZXIodmFsMSkgPyAodmFsMSArIHZhbDIpIDogKHBhcnNlRmxvYXQodmFsMSkgKyB2YWwyKS50b0ZpeGVkKDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYoaW5kZXggPT09IGFycmF5Lmxlbmd0aC0xKSBvYmoxW2tleV0gPSBvYmoxW2tleV0gLyBhcnJheS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihhbmd1bGFyLmlzQXJyYXkob2JqMVtrZXldKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcHVzaCB0byB0aGUgYXJyYXkgb2Ygc3RyaW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajFba2V5XS5wdXNoKG9iajJba2V5XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBhcnJheSBhbmQgYWRkIHZhbHVlcyB0byBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iajFba2V5XSA9IFtdLmNvbmNhdChvYmoxW2tleV0sIG9iajJba2V5XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNvcnRPYmpCeShhcnJheSwga2V5LCBkZXNjZW5kKXtcbiAgICAgICAgICAgIHZhciBzb3J0ZWQgPSBhcnJheS5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuICAgICAgICAgICAgICAgIGlmKGFba2V5XSA+IGJba2V5XSkgcmV0dXJuIGRlc2NlbmQgPyAtMSA6IDE7XG4gICAgICAgICAgICAgICAgaWYoYVtrZXldIDwgYltrZXldKSByZXR1cm4gZGVzY2VuZCA/IDEgOiAtMTtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHNvcnRlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHF1ZXJ5VG9PYmplY3QoZGF0YSwga2V5cyl7XG4gICAgICAgICAgICB2YXIgb2JqLCBrZXk7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS5tYXAoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIG9iaiA9IHt9O1xuICAgICAgICAgICAgICAgIGl0ZW0uZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIG9ialtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcGVyaW9kVG9SYW5nZShwZXJpb2Qpe1xuICAgICAgICAgICAgdmFyIGFyciA9IHBlcmlvZC5zcGxpdCgnICcpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBiZWdpbjogbW9tZW50KCkuc3RhcnRPZihhcnJbMV0pLnRvRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGVuZDogbW9tZW50KCkuZW5kT2YoYXJyWzFdKS50b0RhdGUoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIHJldHVybiB7XG4gICAgICAgICAgICAvLyAgICAgYmVnaW46IG1vbWVudCgpLnN1YnRyYWN0KHBhcnNlSW50KGFyclswXSwgMTApLCBhcnJbMV0pLnRvRGF0ZSgpLFxuICAgICAgICAgICAgLy8gICAgIGVuZDogbW9tZW50KCkuZW5kT2YoJ2RheScpLnRvRGF0ZSgpXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBmaWx0ZXJCeUtleShvYmplY3QsIGtleSl7XG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0W2tleV07XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBmaWx0ZXJVbmlxdWUoaXRlbSwgaW5kZXgsIGFycmF5KXtcbiAgICAgICAgICAgIGlmKGFycmF5LmluZGV4T2YoaXRlbSkgPT09IC0xKSByZXR1cm4gaXRlbTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwJylcblx0XHQuZGlyZWN0aXZlKCdwaWNrZXInLCBwaWNrZXIpO1xuXG5cdGZ1bmN0aW9uIHBpY2tlcigpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0cmVwbGFjZTogdHJ1ZSxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRzY29wZToge1xuXHRcdFx0XHRiZWdpbjogXCJAP1wiLFxuXHRcdFx0XHRlbmQ6IFwiQD9cIixcblx0XHRcdFx0bWluRGF0ZTogXCJAP1wiLFxuXHRcdFx0XHRtYXhEYXRlOiBcIkA/XCIsXG5cdFx0XHRcdGxhYmVsOiBcIkA/XCIsXG5cdFx0XHRcdG9uU3VibWl0OiBcIiY/XCIsXG5cdFx0XHRcdG9uQ2hhbmdlOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiBbXG5cdFx0XHRcdCc8bWQtZGF0ZXBpY2tlciBuZy1jaGFuZ2U9e3tvbkNoYW5nZX19IG5nLW1vZGVsPVwie3tiZWdpbn19XCIgbWQtbWF4LWRhdGU9XCJ7e21heERhdGV9fVwiPjwvbWQtZGF0ZXBpY2tlcj4nLFxuXHRcdFx0XHQnPG1kLWRhdGVwaWNrZXIgbmctY2hhbmdlPXt7b25DaGFuZ2V9fSBuZy1tb2RlbD1cInt7ZW5kfX1cIiBtZC1taW4tZGF0ZT1cInt7bWluRGF0ZX19XCI+PC9tZC1kYXRlcGlja2VyPicsXG5cdFx0XHRcdCc8bWQtYnV0dG9uIGNsYXNzPVwibWQtcHJpbWFyeVwiIG5nLWNsaWNrPVwie3tvblN1Ym1pdH19XCIgYXJpYS1sYWJlbD1cInt7bGFiZWx9fVwiPnt7bGFiZWx9fTwvbWQtYnV0dG9uPicsXG5cdFx0XHRdLmpvaW4oJycpLFxuXHRcdFx0Y29udHJvbGxlcjogWyAnJHNjb3BlJywgJ3N0b3JlJywgZnVuY3Rpb24oJHNjb3BlLCBzdG9yZSkge1xuXHRcdFx0XHRcblxuXHRcdFx0XHRcblx0XHRcdH1dXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAnKVxuXHRcdC5jb250cm9sbGVyKCdTcGlubmVyQ29udHJvbGxlcicsIFNwaW5uZXJDb250cm9sbGVyKTtcblxuXHRTcGlubmVyQ29udHJvbGxlci4kaW5qZWN0ID0gWydzcGlubmVyU2VydmljZScsICckc2NvcGUnXTtcblxuXHRmdW5jdGlvbiBTcGlubmVyQ29udHJvbGxlcihzcGlubmVyU2VydmljZSwgJHNjb3BlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgc2hvdWxkIGJlIHRydWUgYnkgZGVmYXVsdCBpZiBub3Qgc3BlY2lmaWVkLlxuXHRcdGlmICghdm0uaGFzT3duUHJvcGVydHkoJ3JlZ2lzdGVyJykpIHtcblx0XHRcdHZtLnJlZ2lzdGVyID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dm0ucmVnaXN0ZXIgPSB2bS5yZWdpc3Rlci50b0xvd2VyQ2FzZSgpID09PSAnZmFsc2UnID8gZmFsc2UgOiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIERlY2xhcmUgYSBtaW5pLUFQSSB0byBoYW5kIG9mZiB0byBvdXIgc2VydmljZSBzbyB0aGUgc2VydmljZVxuXHRcdC8vIGRvZXNuJ3QgaGF2ZSBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhpcyBkaXJlY3RpdmUncyBzY29wZS5cblx0XHR2YXIgYXBpID0ge1xuXHRcdFx0bmFtZTogdm0ubmFtZSxcblx0XHRcdGdyb3VwOiB2bS5ncm91cCxcblx0XHRcdHNob3c6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm0uc2hvdyA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0aGlkZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2bS5zaG93ID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dG9nZ2xlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZtLnNob3cgPSAhdm0uc2hvdztcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gUmVnaXN0ZXIgdGhpcyBzcGlubmVyIHdpdGggdGhlIHNwaW5uZXIgc2VydmljZS5cblx0XHRpZiAodm0ucmVnaXN0ZXIgPT09IHRydWUpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdzcGlubmVyOiAnLCBhcGkpO1xuXHRcdFx0c3Bpbm5lclNlcnZpY2UuX3JlZ2lzdGVyKGFwaSk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgYW4gb25TaG93IG9yIG9uSGlkZSBleHByZXNzaW9uIHdhcyBwcm92aWRlZCwgcmVnaXN0ZXIgYSB3YXRjaGVyXG5cdFx0Ly8gdGhhdCB3aWxsIGZpcmUgdGhlIHJlbGV2YW50IGV4cHJlc3Npb24gd2hlbiBzaG93J3MgdmFsdWUgY2hhbmdlcy5cblx0XHRpZiAodm0ub25TaG93IHx8IHZtLm9uSGlkZSkge1xuXHRcdFx0JHNjb3BlLiR3YXRjaCgnc2hvdycsIGZ1bmN0aW9uIChzaG93KSB7XG5cdFx0XHRcdGlmIChzaG93ICYmIHZtLm9uU2hvdykge1xuXHRcdFx0XHRcdHZtLm9uU2hvdyh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFzaG93ICYmIHZtLm9uSGlkZSkge1xuXHRcdFx0XHRcdHZtLm9uSGlkZSh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBUaGlzIHNwaW5uZXIgaXMgZ29vZCB0byBnby4gRmlyZSB0aGUgb25Mb2FkZWQgZXhwcmVzc2lvbi5cblx0XHRpZiAodm0ub25Mb2FkZWQpIHtcblx0XHRcdHZtLm9uTG9hZGVkKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcCcpXG5cdFx0LmRpcmVjdGl2ZSgnc3Bpbm5lcicsIHNwaW5uZXIpO1xuXG5cdGZ1bmN0aW9uIHNwaW5uZXIoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHJlcGxhY2U6IHRydWUsXG5cdFx0XHR0cmFuc2NsdWRlOiB0cnVlLFxuXHRcdFx0c2NvcGU6IHtcblx0XHRcdFx0bmFtZTogJ0A/Jyxcblx0XHRcdFx0Z3JvdXA6ICdAPycsXG5cdFx0XHRcdHNob3c6ICdAPycsXG5cdFx0XHRcdGltZ1NyYzogJ0A/Jyxcblx0XHRcdFx0cmVnaXN0ZXI6ICdAPycsXG5cdFx0XHRcdG9uTG9hZGVkOiAnJj8nLFxuXHRcdFx0XHRvblNob3c6ICcmPycsXG5cdFx0XHRcdG9uSGlkZTogJyY/J1xuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiBbXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwic3Bpbm5lci1sb2FkZXIgYW5pbWF0ZS1zaG93XCIgbmctc2hvdz1cInNob3dcIj4nLFxuXHRcdFx0XHQnICA8aW1nIG5nLWlmPVwiaW1nU3JjXCIgbmctc3JjPVwie3tpbWdTcmN9fVwiIC8+Jyxcblx0XHRcdFx0JyAgPG5nLXRyYW5zY2x1ZGU+PC9uZy10cmFuc2NsdWRlPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpLFxuXHRcdFx0Y29udHJvbGxlcjogWyAnJHNjb3BlJywgJ3NwaW5uZXJTZXJ2aWNlJywgZnVuY3Rpb24oJHNjb3BlLCBzcGlubmVyU2VydmljZSkge1xuXHRcdFx0XHQvLyByZWdpc3RlciBzaG91bGQgYmUgdHJ1ZSBieSBkZWZhdWx0IGlmIG5vdCBzcGVjaWZpZWQuXG5cdFx0XHRcdGlmICghJHNjb3BlLmhhc093blByb3BlcnR5KCdyZWdpc3RlcicpKSB7XG5cdFx0XHRcdFx0JHNjb3BlLnJlZ2lzdGVyID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkc2NvcGUucmVnaXN0ZXIgPSAkc2NvcGUucmVnaXN0ZXIudG9Mb3dlckNhc2UoKSA9PT0gJ2ZhbHNlJyA/IGZhbHNlIDogdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERlY2xhcmUgYSBtaW5pLUFQSSB0byBoYW5kIG9mZiB0byBvdXIgc2VydmljZSBzbyB0aGUgc2VydmljZVxuXHRcdFx0XHQvLyBkb2Vzbid0IGhhdmUgYSBkaXJlY3QgcmVmZXJlbmNlIHRvIHRoaXMgZGlyZWN0aXZlJ3Mgc2NvcGUuXG5cdFx0XHRcdHZhciBhcGkgPSB7XG5cdFx0XHRcdFx0bmFtZTogJHNjb3BlLm5hbWUsXG5cdFx0XHRcdFx0Z3JvdXA6ICRzY29wZS5ncm91cCxcblx0XHRcdFx0XHRzaG93OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9IHRydWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRoaWRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9IGZhbHNlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dG9nZ2xlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9ICEkc2NvcGUuc2hvdztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gUmVnaXN0ZXIgdGhpcyBzcGlubmVyIHdpdGggdGhlIHNwaW5uZXIgc2VydmljZS5cblx0XHRcdFx0aWYgKCRzY29wZS5yZWdpc3RlciA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdzcGlubmVyOiAnLCBhcGkpO1xuXHRcdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLl9yZWdpc3RlcihhcGkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgYW4gb25TaG93IG9yIG9uSGlkZSBleHByZXNzaW9uIHdhcyBwcm92aWRlZCwgcmVnaXN0ZXIgYSB3YXRjaGVyXG5cdFx0XHRcdC8vIHRoYXQgd2lsbCBmaXJlIHRoZSByZWxldmFudCBleHByZXNzaW9uIHdoZW4gc2hvdydzIHZhbHVlIGNoYW5nZXMuXG5cdFx0XHRcdGlmICgkc2NvcGUub25TaG93IHx8ICRzY29wZS5vbkhpZGUpIHtcblx0XHRcdFx0XHQkc2NvcGUuJHdhdGNoKCdzaG93JywgZnVuY3Rpb24gKHNob3cpIHtcblx0XHRcdFx0XHRcdGlmIChzaG93ICYmICRzY29wZS5vblNob3cpIHtcblx0XHRcdFx0XHRcdFx0JHNjb3BlLm9uU2hvdyh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICghc2hvdyAmJiAkc2NvcGUub25IaWRlKSB7XG5cdFx0XHRcdFx0XHRcdCRzY29wZS5vbkhpZGUoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRoaXMgc3Bpbm5lciBpcyBnb29kIHRvIGdvLiBGaXJlIHRoZSBvbkxvYWRlZCBleHByZXNzaW9uLlxuXHRcdFx0XHRpZiAoJHNjb3BlLm9uTG9hZGVkKSB7XG5cdFx0XHRcdFx0JHNjb3BlLm9uTG9hZGVkKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdzcGlubmVyU2VydmljZScsIHNwaW5uZXJTZXJ2aWNlKTtcblxuICAgIGZ1bmN0aW9uIHNwaW5uZXJTZXJ2aWNlKCl7XG5cbiAgICAgICAgdmFyIHNwaW5uZXJzID0ge307XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgX3JlZ2lzdGVyOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGlmICghZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiU3Bpbm5lciBtdXN0IHNwZWNpZnkgYSBuYW1lIHdoZW4gcmVnaXN0ZXJpbmcgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzcGlubmVycy5oYXNPd25Qcm9wZXJ0eShkYXRhLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiQSBzcGlubmVyIHdpdGggdGhlIG5hbWUgJ1wiICsgZGF0YS5uYW1lICsgXCInIGhhcyBhbHJlYWR5IGJlZW4gcmVnaXN0ZXJlZC5cIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcGlubmVyc1tkYXRhLm5hbWVdID0gZGF0YTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzaG93OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBzcGlubmVyID0gc3Bpbm5lcnNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFzcGlubmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiTm8gc3Bpbm5lciBuYW1lZCAnXCIgKyBuYW1lICsgXCInIGlzIHJlZ2lzdGVyZWQuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3Bpbm5lci5zaG93KCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaGlkZTogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3Bpbm5lciA9IHNwaW5uZXJzW25hbWVdO1xuICAgICAgICAgICAgICAgIGlmICghc3Bpbm5lcikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBzcGlubmVyIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgcmVnaXN0ZXJlZC5cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNwaW5uZXIuaGlkZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNob3dBbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNwaW5uZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXJzW25hbWVdLnNob3coKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaGlkZUFsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc3Bpbm5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lcnNbbmFtZV0uaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5kaXJlY3RpdmUoJ3NpZGVNZW51Jywgc2lkZU1lbnUpO1xuXG5cdGZ1bmN0aW9uIHNpZGVNZW51KCl7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBRScsXG5cdFx0XHR0cmFuc2NsdWRlOiB0cnVlLFxuXHRcdFx0Y29udHJvbGxlcjogJ1NpZGVtZW51Q29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdzaWRlbWVudVZtJyxcblx0XHRcdHRlbXBsYXRlVXJsOiAnbGF5b3V0L3NpZGVtZW51L3NpZGVtZW51Lmh0bWwnXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAubGF5b3V0Jylcblx0XHQuY29udHJvbGxlcignU2lkZW1lbnVDb250cm9sbGVyJywgU2lkZW1lbnVDb250cm9sbGVyKTtcblxuXHRTaWRlbWVudUNvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckbWRTaWRlbmF2J107XG5cblx0ZnVuY3Rpb24gU2lkZW1lbnVDb250cm9sbGVyKCRyb290U2NvcGUsICRtZFNpZGVuYXYpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dm0uaXNPcGVuID0gZmFsc2U7XG5cblx0XHQkcm9vdFNjb3BlLiRvbignJHJvdXRlQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYodm0uaXNPcGVuKSBcblx0XHRcdFx0JG1kU2lkZW5hdignc2lkZW5hdicpLnRvZ2dsZSgpO1xuXHRcdH0pO1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdUb3BiYXJDb250cm9sbGVyJywgVG9wYmFyQ29udHJvbGxlcik7XG5cblx0VG9wYmFyQ29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJywgJyRzY29wZScsICckbWRTaWRlbmF2J107XG5cblx0ZnVuY3Rpb24gVG9wYmFyQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkc2NvcGUsICRtZFNpZGVuYXYpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS50b2dnbGVTaWRlbWVudSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0JG1kU2lkZW5hdignc2lkZW5hdicpLnRvZ2dsZSgpO1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmRpcmVjdGl2ZSgndG9wQmFyJywgdG9wQmFyKTtcblxuXHRmdW5jdGlvbiB0b3BCYXIoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRjb250cm9sbGVyOiAnVG9wYmFyQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICd0b3BiYXJWbScsXG5cdFx0XHR0ZW1wbGF0ZVVybDogJ2xheW91dC90b3BiYXIvdG9wYmFyLmh0bWwnLFxuXHRcdH07XG5cblx0fVxuXG59KSgpOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
