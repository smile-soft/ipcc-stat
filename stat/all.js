angular.module('app', [
	'app.core',
	'app.config',
	'app.routes',
	'app.layout',
	'app.crr',
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
			period: '1 year'
		};
		var perfStat = [];
		var agentStat = [];

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
			spinnerService.show('crr-loader');

			return getAgentsStat(vm.settings.tables, vm.begin.valueOf(), vm.end.valueOf())
			.then(function(astat) {
				debug.log('getAgentsStat data: ', astat.data.result);
				agentStat = astat.data.result
				return getPerfStat(vm.settings.tables, vm.begin.valueOf(), vm.end.valueOf());
			})
			.then(function(pstat) {
				debug.log('getPerfStat data: ', pstat.data.result);
				perfStat = pstat.data.result;
				vm.stat = angular.merge([], agentStat, perfStat);
				vm.stat.map(addPerfValue);
				
				debug.log('vm.stat: ', vm.stat);
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
		vm.periods = ['1 hour', '1 day', '1 week', '1 month', '1 year'];
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

	DashController.$inject = ['$rootScope', '$scope', '$timeout', '$q', '$mdMedia', '$mdBottomSheet', '$mdDialog', '$mdToast', 'store', 'SettingsService', 'apiService', 'spinnerService', 'colourGenerator', 'debugService', 'errorService', 'utilsService'];

	function DashController($rootScope, $scope, $timeout, $q, $mdMedia, $mdBottomSheet, $mdDialog, $mdToast, store, SettingsService, api, spinnerService, colourGenerator, debug, errorService, utils) {

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
		// vm.catTotals = {};
		// vm.subcatTotals = {};
		vm.selectedCat = null;
		vm.subCatsStat = [];
		vm.catchartData = {};
		vm.catchartLabel = 'nca';
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
				vm.catchartData = setCatchartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description);
			else
				if(vm.options.db.tables) vm.catchartData = setCatchartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description);
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
					callstable: tables.calls,
					cattable: tables.categories,
					subcattable: tables.subcategories,
					catorder: tables.categories.columns.description
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
					if(vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(getCategoriesStat)
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
					if(vm.options.callstable.columns.callresult) {
						return getCallResolutionStat();
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function(){ spinnerService.hide(item.name+'-loader'); })
				.catch(function(){ spinnerService.hide(item.name+'-loader'); });
			});

			getCategoriesStat();

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
				vm.catchartData = setCatchartData(vm.catstat, vm.catchartLabel, vm.options.db.tables.categories.columns.description);
				return;
			}
			else vm.selectedCat = cat;

			getSubCategoriesStat(cat[vm.options.callstable.columns.category])
			.then(function(result) {
				var data = result.data, totals = {};
				if(data.error) return errorService.show(data.error.message);
				if(!data.result.length) return;

				// vm.subcatTotals = data.result.reduce(utils.getTotals);
				vm.subCatsStat = setCatsStat(data.result, data.result.reduce(utils.getTotals));
				vm.catchartData = setCatchartData(vm.subCatsStat, vm.catchartLabel, vm.options.db.tables.subcategories.columns.description);
			})
			.catch(errorService.show);
		}

		function onSubCatSelect(cat, subcat, index) {
			var tables = vm.options.db.tables,
				tcols = tables.calls.columns,
				columns = [tcols.operator, tcols.customer_phone, tcols.calldate, tcols.comments],
				data;

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
			if(tables.companies) vm.options.tablesList.push(tables.companies.name);

			spinnerService.show('categories-loader');
			api.getCustomListStatistics({
				// tables: ['probstat', 'probcat', 'probcompany'],
				tables: vm.options.tablesList,
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: [tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						// ' and tasktype in ('+getTaskKinds().join(',')+')'+
						' and taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid'+
						(tables.calls.columns.company ?
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') :
						''),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.category, tables.categories.columns.description],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(function(result) {
				data = result.data;
				if(!data.result.length) return spinnerService.hide('categories-loader');
				if(data.error) return errorService.show(data.error.message);
				
				// vm.catTotals = data.result.reduce(utils.getTotals);
				vm.catstat = setCatsStat(data.result, data.result.reduce(utils.getTotals));
				debug.log('getCategoriesStat catstat: ', vm.catstat);
				vm.catchartData = setCatchartData(vm.catstat, vm.catchartLabel, tables.categories.columns.description);
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
				tabrel: (cat ? [tables.categories.name, tables.categories.columns.id].join('.')+'='+cat+' and ' : '') +
						' taskid in (\''+getTaskIds().join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+
						(subcat ? ' and '+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+'='+subcat : '') +
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						(tables.calls.columns.subcategory ? ' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.') : '')+
						(tables.calls.columns.company ? ' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.') : ''),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
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

		function setCatchartData(array, datakey, labelkey){
			var newArray = [], data = [], labels = [], colours = [], itemData;

			sortObjBy(array, datakey, 'descend')
			.map(function(item){
				data.push(angular.isNumber(item[datakey]) ? item[datakey].toFixed(2) : item[datakey] );
				labels.push(item[labelkey]);
				colours.push(getCategoryColour(item[labelkey]));
			});
			
			
			store.set('options', vm.options);

			return {
				data: data,
				labels: labels,
				colours: colours
			};
		}

		function getCategoryColour(cat){
			var catColours = vm.options.catColours,
				found = false, colour = '';

			catColours.forEach(function(item){
				if(item.name === cat) found = item;
			});

			if(found) {
				colour = found.colour;
			} else {
				colour = colourGenerator.getColor();
				vm.options.catColours.push({ name: cat, colour: colour });
			}
			return colour;
		}

		function sortObjBy(array, key, descend){
			var sorted = array.sort(function(a, b){
				if(a[key] > b[key]) return descend ? -1 : 1;
				if(a[key] < b[key]) return descend ? 1 : -1;
				return 0;
			});
			return sorted;
		}

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

		vm.order = tables.calls.columns.calldate,
		vm.search = '';
		vm.filter = {
			callresult: ''
		};

		vm.exportName = 'processes';
		// vm.exportName = $filter('date')(vm.begin, 'dd.MM.yy') + '-' + $filter('date')(vm.end, 'dd.MM.yy');

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

    apiService.$inject = ['$http', 'appConfig', 'errorService'];

    function apiService($http, appConfig, errorService){

        var baseUrl = appConfig.server;

        return {
            getDbSettings: getDbSettings,
            getTasks: getTasks,
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
            var reqParams = {
                method: 'getQueryResultSet',
                params: {
                    query: ['SELECT', params.columns, 'FROM', params.tables, 'WHERE', 'processed.procid='+params.procid, 'and', params.tabrel, 'and timestart between', moment(params.begin).unix(), 'and', moment(params.end).unix(), (params.groupBy ? 'group by '+params.groupBy : '')].join(' ')
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
            // return moment().subtract(arr[0], arr[1]).toDate();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFwcC5jb25maWcuanMiLCJhcHAuY29yZS5qcyIsImFwcC5jcnIuanMiLCJhcHAuZGFzaGJvYXJkLmpzIiwiYXBwLmxheW91dC5qcyIsImFwcC5yb3V0ZXMuanMiLCJjcnIvY3JyLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJjcnIvY3JyLmNvbnRyb2xsZXIuanMiLCJjcnIvY3JyLnJvdXRlLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC1leHBvcnQuY29udHJvbGxlci5qcyIsImRhc2hib2FyZC9kYXNoYm9hcmQtc2V0dGluZ3MuY29udHJvbGxlci5qcyIsImRhc2hib2FyZC9kYXNoYm9hcmQuY29udHJvbGxlci5qcyIsImRhc2hib2FyZC9kYXNoYm9hcmQucm91dGUuanMiLCJkYXNoYm9hcmQva2luZC1zZXR0aW5ncy5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL3Byb2Nlc3Nlcy1leHBvcnQuY29udHJvbGxlci5qcyIsImRhc2hib2FyZC9zdGF0LWNhcmQuZGlyZWN0aXZlLmpzIiwiZmlsdGVycy9maWx0ZXJzLmpzIiwibGF5b3V0L2xheW91dC5jb250cm9sbGVyLmpzIiwic2VydmljZXMvYXBpLmpzIiwic2VydmljZXMvY29sb3VyLWdlbi5qcyIsInNlcnZpY2VzL2RlYnVnLmpzIiwic2VydmljZXMvZXJyb3IuanMiLCJzZXJ2aWNlcy9zZXR0aW5ncy5qcyIsInNlcnZpY2VzL3Rhc2tzLmpzIiwic2VydmljZXMvdXRpbHMuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvX19zcGlubmVyLmNvbnRyb2xsZXIuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5zZXJ2aWNlLmpzIiwibGF5b3V0L3NpZGVtZW51L3NpZGUtbWVudS5kaXJlY3RpdmUuanMiLCJsYXlvdXQvc2lkZW1lbnUvc2lkZW1lbnUuY29udHJvbGxlci5qcyIsImxheW91dC90b3BiYXIvdG9wLWJhci5jb250cm9sbGVyLmpzIiwibGF5b3V0L3RvcGJhci90b3AtYmFyLmRpcmVjdGl2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDUEE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbm1CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYWxsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiYW5ndWxhci5tb2R1bGUoJ2FwcCcsIFtcblx0J2FwcC5jb3JlJyxcblx0J2FwcC5jb25maWcnLFxuXHQnYXBwLnJvdXRlcycsXG5cdCdhcHAubGF5b3V0Jyxcblx0J2FwcC5jcnInLFxuXHQnYXBwLmRhc2hib2FyZCdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuY29uZmlnJywgW1xuXHQnYXBwLmNvcmUnXG5dKVxuLmNvbnN0YW50KCdhcHBDb25maWcnLCB7XG5cdHNlcnZlcjogd2luZG93LmxvY2F0aW9uLnByb3RvY29sICsgJy8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0XG59KVxuLmNvbmZpZyhbJyRjb21waWxlUHJvdmlkZXInLCBmdW5jdGlvbiAoJGNvbXBpbGVQcm92aWRlcikge1xuICAkY29tcGlsZVByb3ZpZGVyLmRlYnVnSW5mb0VuYWJsZWQoZmFsc2UpO1xufV0pXG4uY29uZmlnKFsnQ2hhcnRKc1Byb3ZpZGVyJyxmdW5jdGlvbihDaGFydEpzUHJvdmlkZXIpIHtcblx0Q2hhcnRKc1Byb3ZpZGVyLnNldE9wdGlvbnMoe1xuXHRcdGxlZ2VuZFRlbXBsYXRlIDogXCI8dWwgY2xhc3M9XFxcImN1c3RvbS1sZWdlbmQgPCU9bmFtZS50b0xvd2VyQ2FzZSgpJT4tbGVnZW5kXFxcIj48JSBmb3IgKHZhciBpPTA7IGk8c2VnbWVudHMubGVuZ3RoOyBpKyspeyU+PGxpPjxzcGFuIHN0eWxlPVxcXCJiYWNrZ3JvdW5kLWNvbG9yOjwlPXNlZ21lbnRzW2ldLmZpbGxDb2xvciU+XFxcIj48L3NwYW4+PCVpZihzZWdtZW50c1tpXS5sYWJlbCl7JT48JT1zZWdtZW50c1tpXS5sYWJlbCU+PCV9JT48L2xpPjwlfSU+PC91bD5cIlxuXHR9KTtcbn1dKTtcblxuLy8gLmNvbmZpZyhbJyRtZFRoZW1pbmdQcm92aWRlcicsZnVuY3Rpb24oJG1kVGhlbWluZ1Byb3ZpZGVyKSB7XG4vLyBcdCRtZFRoZW1pbmdQcm92aWRlci50aGVtZSgnY3lhbicpO1xuLy8gfV0pXG4vLyAuY29uZmlnKFsnJHRyYW5zbGF0ZVByb3ZpZGVyJywgZnVuY3Rpb24oJHRyYW5zbGF0ZVByb3ZpZGVyKSB7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci51c2VTdGF0aWNGaWxlc0xvYWRlcih7XG4vLyBcdFx0cHJlZml4OiAnL3RyYW5zbGF0aW9ucy9sb2NhbGUtJyxcbi8vIFx0XHRzdWZmaXg6ICcuanNvbidcbi8vIFx0fSk7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci5wcmVmZXJyZWRMYW5ndWFnZSgnZW4nKTtcbi8vIFx0JHRyYW5zbGF0ZVByb3ZpZGVyLmZhbGxiYWNrTGFuZ3VhZ2UoJ2VuJyk7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci51c2VTdG9yYWdlKCdzdG9yYWdlJyk7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci51c2VTYW5pdGl6ZVZhbHVlU3RyYXRlZ3koJ3Nhbml0aXplUGFyYW1ldGVycycpO1xuLy8gXHQvLyAkdHJhbnNsYXRlUHJvdmlkZXIudXNlU2FuaXRpemVWYWx1ZVN0cmF0ZWd5KCdlc2NhcGUnKTtcbi8vIH1dKVxuLy8gLmNvbmZpZyhbJ3RtaER5bmFtaWNMb2NhbGVQcm92aWRlcicsIGZ1bmN0aW9uKHRtaER5bmFtaWNMb2NhbGVQcm92aWRlcikge1xuLy8gXHR0bWhEeW5hbWljTG9jYWxlUHJvdmlkZXIubG9jYWxlTG9jYXRpb25QYXR0ZXJuKCcuL2pzL2xpYi9pMThuL2FuZ3VsYXItbG9jYWxlX3t7bG9jYWxlfX0uanMnKTtcbi8vIH1dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNvcmUnLCBbXG5cdCduZ0FuaW1hdGUnLFxuXHQnbmdNYXRlcmlhbCcsXG5cdCdhbmd1bGFyTW9tZW50Jyxcblx0J2FuZ3VsYXItc3RvcmFnZScsXG5cdCdtZC5kYXRhLnRhYmxlJyxcblx0J2NoYXJ0LmpzJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5jcnInLCBbXG5cdCdhcHAuY29yZSdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuZGFzaGJvYXJkJywgW1xuXHQnYXBwLmNvcmUnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmxheW91dCcsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5yb3V0ZXMnLCBbXG5cdCduZ1JvdXRlJ1xuXSlcbi5jb25maWcoWyckcm91dGVQcm92aWRlcicsIGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKXtcblxuXHQkcm91dGVQcm92aWRlci5cblx0XHRvdGhlcndpc2Uoe1xuXHRcdFx0cmVkaXJlY3RUbzogJy9kYXNoYm9hcmQnXG5cdFx0fSk7XG59XSk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuY3JyJylcblx0XHQuY29udHJvbGxlcignQ3JyU2V0dGluZ3NDb250cm9sbGVyJywgQ3JyU2V0dGluZ3NDb250cm9sbGVyKTtcblxuXHRDcnJTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRtZERpYWxvZycsICd0YXNrcycsICdzZWxlY3RlZFRhc2tzJywgJ2RlYnVnU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIENyclNldHRpbmdzQ29udHJvbGxlcigkc2NvcGUsICRtZERpYWxvZywgdGFza3MsIHNlbGVjdGVkVGFza3MsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0udGFza3MgPSBbXS5jb25jYXQodGFza3MpO1xuXHRcdHZtLnNlbGVjdGVkVGFza3MgPSBbXS5jb25jYXQoc2VsZWN0ZWRUYXNrcyk7XG5cdFx0dm0uc2VsZWN0QWxsVGFza3MgPSBzZWxlY3RBbGxUYXNrcztcblx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gKHRhc2tzLmxlbmd0aCA9PT0gc2VsZWN0ZWRUYXNrcy5sZW5ndGgpO1xuXHRcdHZtLnNhdmUgPSBzYXZlO1xuXHRcdHZtLmNsb3NlID0gY2xvc2VTZXR0aW5ncztcblx0XHR2bS50b2dnbGUgPSB0b2dnbGU7XG5cdFx0dm0uaW5kZXggPSBpbmRleDtcblx0XHR2bS5leGlzdHMgPSBleGlzdHM7XG5cblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCl7XG5cdFx0XHRyZXR1cm4gdm0uc2VsZWN0ZWRUYXNrcy5sZW5ndGg7XG5cdFx0fSwgZnVuY3Rpb24odmFsKXtcblx0XHRcdHZtLmFsbFRhc2tzU2VsZWN0ZWQgPSB2bS5zZWxlY3RlZFRhc2tzLmxlbmd0aCA9PT0gdm0udGFza3MubGVuZ3RoO1xuXHRcdH0pO1xuXG5cdFx0ZGVidWcubG9nKCd0YXNrc20gc2VsZWN0ZWRUYXNrczogJywgdm0udGFza3MsIHZtLnNlbGVjdGVkVGFza3MpO1xuXG5cdFx0ZnVuY3Rpb24gc2F2ZSgpIHtcblx0XHRcdCRtZERpYWxvZy5oaWRlKHtcblx0XHRcdFx0c2VsZWN0ZWRUYXNrczogdm0uc2VsZWN0ZWRUYXNrc1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY2xvc2VTZXR0aW5ncygpIHtcblx0XHRcdCRtZERpYWxvZy5jYW5jZWwoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZWxlY3RBbGxUYXNrcygpIHtcblx0XHRcdGlmKHZtLmFsbFRhc2tzU2VsZWN0ZWQpIHZtLnNlbGVjdGVkVGFza3MgPSBbXS5jb25jYXQodGFza3MpO1xuXHRcdFx0ZWxzZSB2bS5zZWxlY3RlZFRhc2tzID0gW107XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdG9nZ2xlKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHZhciBpZHggPSBpbmRleChpdGVtLCBsaXN0KTtcblx0XHRcdGlmIChpZHggIT09IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gaW5kZXgoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IC0xO1xuXHRcdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGxpc3RJdGVtLCBpbmRleCl7XG5cdFx0XHRcdGlmKGxpc3RJdGVtID09IGl0ZW0pIGlkeCA9IGluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaWR4O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGV4aXN0cyhpdGVtLCBsaXN0KSB7XG5cdFx0XHRyZXR1cm4gbGlzdC5pbmRleE9mKGl0ZW0pID4gLTE7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5jcnInKVxuXHRcdC5jb250cm9sbGVyKCdDcnJDb250cm9sbGVyJywgQ3JyQ29udHJvbGxlcik7XG5cblx0Q3JyQ29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJywgJyRtZERpYWxvZycsICdTZXR0aW5nc1NlcnZpY2UnLCAnYXBpU2VydmljZScsICdUYXNrc1NlcnZpY2UnLCAndXRpbHNTZXJ2aWNlJywgJ2RlYnVnU2VydmljZScsICdzcGlubmVyU2VydmljZScsICdlcnJvclNlcnZpY2UnXTtcblxuXHRmdW5jdGlvbiBDcnJDb250cm9sbGVyKCRyb290U2NvcGUsICRtZERpYWxvZywgU2V0dGluZ3NTZXJ2aWNlLCBhcGksIFRhc2tzU2VydmljZSwgdXRpbHMsIGRlYnVnLCBzcGlubmVyU2VydmljZSwgZXJyb3JTZXJ2aWNlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXHRcdHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcblx0XHRcdHBlcmlvZDogJzEgeWVhcidcblx0XHR9O1xuXHRcdHZhciBwZXJmU3RhdCA9IFtdO1xuXHRcdHZhciBhZ2VudFN0YXQgPSBbXTtcblxuXHRcdHZtLnNldHRpbmdzID0ge307XG5cdFx0dm0udGFza3MgPSBbXTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW107XG5cdFx0dm0uc3RhdCA9IFtdO1xuXHRcdHZtLmJlZ2luID0gdXRpbHMucGVyaW9kVG9SYW5nZShkZWZhdWx0T3B0aW9ucy5wZXJpb2QpLmJlZ2luO1xuXHRcdHZtLmVuZCA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdE9wdGlvbnMucGVyaW9kKS5lbmQ7XG5cdFx0dm0uZ2V0Q2FsbFJlc29sdXRpb24gPSBnZXRDYWxsUmVzb2x1dGlvbjtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0udGFibGVTb3J0ID0gJy1wZXJmJztcblxuXHRcdGluaXQoKTtcblx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdtYWluLWxvYWRlcicpO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdCgpIHtcblx0XHRcdFNldHRpbmdzU2VydmljZS5nZXRTZXR0aW5ncygpXG5cdFx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdFx0dm0uc2V0dGluZ3MgPSBkYlNldHRpbmdzO1xuXHRcdFx0XHRyZXR1cm4gVGFza3NTZXJ2aWNlLmdldFRhc2tMaXN0KDEpO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHRhc2tzKSB7XG5cdFx0XHRcdGRlYnVnLmxvZygndGFza3M6ICcsIHRhc2tzLmRhdGEucmVzdWx0KTtcblx0XHRcdFx0dm0udGFza3MgPSB0YXNrcy5kYXRhLnJlc3VsdDtcblx0XHRcdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IHRhc2tzLmRhdGEucmVzdWx0O1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGdldENhbGxSZXNvbHV0aW9uKVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvcGVuU2V0dGluZ3MoJGV2ZW50KSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnY3JyL2Nyci1zZXR0aW5ncy5odG1sJyxcblx0XHRcdFx0Y29udHJvbGxlcjogJ0NyclNldHRpbmdzQ29udHJvbGxlcicsXG5cdFx0XHRcdGNvbnRyb2xsZXJBczogJ2NyclNldHRzVm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0dGFza3M6IHZtLnRhc2tzLFxuXHRcdFx0XHRcdHNlbGVjdGVkVGFza3M6IHZtLnNlbGVjdGVkVGFza3Ncblx0XHRcdFx0fVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IHJlc3VsdC5zZWxlY3RlZFRhc2tzO1xuXHRcdFx0XHRnZXRDYWxsUmVzb2x1dGlvbigpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2FsbFJlc29sdXRpb24oKSB7XG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjcnItbG9hZGVyJyk7XG5cblx0XHRcdHJldHVybiBnZXRBZ2VudHNTdGF0KHZtLnNldHRpbmdzLnRhYmxlcywgdm0uYmVnaW4udmFsdWVPZigpLCB2bS5lbmQudmFsdWVPZigpKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oYXN0YXQpIHtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRBZ2VudHNTdGF0IGRhdGE6ICcsIGFzdGF0LmRhdGEucmVzdWx0KTtcblx0XHRcdFx0YWdlbnRTdGF0ID0gYXN0YXQuZGF0YS5yZXN1bHRcblx0XHRcdFx0cmV0dXJuIGdldFBlcmZTdGF0KHZtLnNldHRpbmdzLnRhYmxlcywgdm0uYmVnaW4udmFsdWVPZigpLCB2bS5lbmQudmFsdWVPZigpKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbihwc3RhdCkge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldFBlcmZTdGF0IGRhdGE6ICcsIHBzdGF0LmRhdGEucmVzdWx0KTtcblx0XHRcdFx0cGVyZlN0YXQgPSBwc3RhdC5kYXRhLnJlc3VsdDtcblx0XHRcdFx0dm0uc3RhdCA9IGFuZ3VsYXIubWVyZ2UoW10sIGFnZW50U3RhdCwgcGVyZlN0YXQpO1xuXHRcdFx0XHR2bS5zdGF0Lm1hcChhZGRQZXJmVmFsdWUpO1xuXHRcdFx0XHRcblx0XHRcdFx0ZGVidWcubG9nKCd2bS5zdGF0OiAnLCB2bS5zdGF0KTtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY3JyLWxvYWRlcicpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QWdlbnRzU3RhdCh0YWJsZXMsIGJlZ2luLCBlbmQpe1xuXHRcdFx0dmFyIGRhdGEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudCgqKScsJ3N1bShjb25uZWN0VGltZSknLCdhdmcoY29ubmVjdFRpbWUpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJyt2bS50YXNrcy5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0sXG5cdFx0XHRcdGJlZ2luOiBiZWdpbixcblx0XHRcdFx0ZW5kOiBlbmQsXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFBlcmZTdGF0KHRhYmxlcywgYmVnaW4sIGVuZCl7XG5cdFx0XHR2YXIgZGF0YSxcblx0XHRcdG1ldHJpY3MgPSBbJ2NvdW50KGNhbGxyZXN1bHQpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJyt2bS50YXNrcy5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0uam9pbignLicpKyc9MScsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0LCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0sXG5cdFx0XHRcdGJlZ2luOiBiZWdpbixcblx0XHRcdFx0ZW5kOiBlbmQsXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFkZFBlcmZWYWx1ZShpdGVtKSB7XG5cdFx0XHRpdGVtLnBlcmYgPSBpdGVtWydjb3VudChjYWxscmVzdWx0KSddIC8gaXRlbVsnY291bnQoKiknXSAqIDEwMDtcblx0XHRcdHJldHVybiBpdGVtO1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5jcnInKVxuLmNvbmZpZyhbJyRyb3V0ZVByb3ZpZGVyJywgZnVuY3Rpb24oJHJvdXRlUHJvdmlkZXIpe1xuXG5cdCRyb3V0ZVByb3ZpZGVyLlxuXHRcdHdoZW4oJy9jcnInLCB7XG5cdFx0XHR0ZW1wbGF0ZVVybDogJ2Nyci9jcnIuaHRtbCcsXG5cdFx0XHRjb250cm9sbGVyOiAnQ3JyQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdjcnJWbSdcblx0XHR9KTtcbn1dKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5jb250cm9sbGVyKCdEYXNoRXhwb3J0Q29udHJvbGxlcicsIERhc2hFeHBvcnRDb250cm9sbGVyKTtcblxuXHREYXNoRXhwb3J0Q29udHJvbGxlci4kaW5qZWN0ID0gWyckbWREaWFsb2cnLCAna2luZHMnLCAndGFibGVzJywgJ2RhdGEnLCAnYmVnaW4nLCAnZW5kJywgJ3N0YXQnLCAncHJldnN0YXQnLCAnY2F0c3RhdCddO1xuXG5cdGZ1bmN0aW9uIERhc2hFeHBvcnRDb250cm9sbGVyKCRtZERpYWxvZywga2luZHMsIHRhYmxlcywgZGF0YSwgYmVnaW4sIGVuZCwgc3RhdCwgcHJldnN0YXQsIGNhdHN0YXQpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS5raW5kcyA9IGtpbmRzO1xuXHRcdHZtLnRhYmxlcyA9IHRhYmxlcztcblx0XHR2bS5kYXRhID0gZGF0YTtcblx0XHR2bS5iZWdpbiA9IGJlZ2luO1xuXHRcdHZtLmVuZCA9IGVuZDtcblx0XHR2bS5zdGF0ID0gc3RhdDtcblx0XHR2bS5wcmV2c3RhdCA9IHByZXZzdGF0O1xuXHRcdHZtLmNhdHN0YXQgPSBjYXRzdGF0O1xuXHRcdHZtLmNsb3NlID0gZnVuY3Rpb24oKXtcblx0XHRcdCRtZERpYWxvZy5oaWRlKCk7XG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignRGFzaFNldHRpbmdzQ29udHJvbGxlcicsIERhc2hTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdERhc2hTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJG1kRGlhbG9nJywgJ29wdGlvbnMnXTtcblxuXHRmdW5jdGlvbiBEYXNoU2V0dGluZ3NDb250cm9sbGVyKCRtZERpYWxvZywgb3B0aW9ucykge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLm9wdGlvbnMgPSBhbmd1bGFyLmNvcHkob3B0aW9ucywge30pO1xuXHRcdHZtLnBlcmlvZHMgPSBbJzEgaG91cicsICcxIGRheScsICcxIHdlZWsnLCAnMSBtb250aCcsICcxIHllYXInXTtcblx0XHR2bS5pbnRlcnZhbHMgPSBbJzEgbWludXRlcycsICc1IG1pbnV0ZXMnLCAnMTAgbWludXRlcycsICcyMCBtaW51dGVzJywgJzMwIG1pbnV0ZXMnLCAnMSBob3VyJ107XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5pbmRleCA9IGluZGV4O1xuXG5cdFx0ZnVuY3Rpb24gc2F2ZSgpIHtcblx0XHRcdCRtZERpYWxvZy5oaWRlKHtcblx0XHRcdFx0b3B0aW9uczogdm0ub3B0aW9uc1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY2xvc2VTZXR0aW5ncygpIHtcblx0XHRcdCRtZERpYWxvZy5jYW5jZWwoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0b2dnbGUoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IHZtLmluZGV4KGl0ZW0sIGxpc3QpO1xuXHRcdFx0aWYgKGlkeCA+IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gaW5kZXgoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IC0xO1xuXHRcdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGxpc3RJdGVtLCBpbmRleCl7XG5cdFx0XHRcdGlmKGxpc3RJdGVtLmtpbmQgPT0gaXRlbS5raW5kKSBpZHggPSBpbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGlkeDtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ0Rhc2hDb250cm9sbGVyJywgRGFzaENvbnRyb2xsZXIpO1xuXG5cdERhc2hDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJHNjb3BlJywgJyR0aW1lb3V0JywgJyRxJywgJyRtZE1lZGlhJywgJyRtZEJvdHRvbVNoZWV0JywgJyRtZERpYWxvZycsICckbWRUb2FzdCcsICdzdG9yZScsICdTZXR0aW5nc1NlcnZpY2UnLCAnYXBpU2VydmljZScsICdzcGlubmVyU2VydmljZScsICdjb2xvdXJHZW5lcmF0b3InLCAnZGVidWdTZXJ2aWNlJywgJ2Vycm9yU2VydmljZScsICd1dGlsc1NlcnZpY2UnXTtcblxuXHRmdW5jdGlvbiBEYXNoQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkc2NvcGUsICR0aW1lb3V0LCAkcSwgJG1kTWVkaWEsICRtZEJvdHRvbVNoZWV0LCAkbWREaWFsb2csICRtZFRvYXN0LCBzdG9yZSwgU2V0dGluZ3NTZXJ2aWNlLCBhcGksIHNwaW5uZXJTZXJ2aWNlLCBjb2xvdXJHZW5lcmF0b3IsIGRlYnVnLCBlcnJvclNlcnZpY2UsIHV0aWxzKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXHRcdHZhciBkZWZhdWx0RGF0YSA9IHtcblx0XHRcdEluY29taW5nX0FnZW50OiB7XG5cdFx0XHRcdGtpbmQ6IDEsXG5cdFx0XHRcdHRhc2tzOiBbXSxcblx0XHRcdFx0bGlzdDogW10sXG5cdFx0XHRcdHNsOiAyMCxcblx0XHRcdFx0bWV0cmljczogWydhaHQnLCAnYXR0JywgJ25jbycsICduY2EnLCAnY2FyJywgJ2FzYSddXG5cdFx0XHR9LFxuXHRcdFx0TWVzc2FnaW5nX0NoYXQ6IHtcblx0XHRcdFx0a2luZDogNyxcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDUsXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJywgJ2NhciddXG5cdFx0XHR9LFxuXHRcdFx0QXV0b2RpYWxfQWdlbnQ6IHtcblx0XHRcdFx0a2luZDogMTI5LFxuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYSddXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDIwLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYScsICdjYXInXVxuXHRcdFx0fVxuXHRcdFx0XHRcblx0XHR9LFxuXHRcdGRlZmF1bHRPcHRpb25zID0ge1xuXHRcdFx0YXV0b3VwZGF0ZTogZmFsc2UsXG5cdFx0XHR1cGRhdGVFdmVyeTogJzEgbWludXRlcycsXG5cdFx0XHRraW5kczogW3tuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfV0sXG5cdFx0XHRraW5kc0xpc3Q6IFt7bmFtZTogJ0luY29taW5nX0FnZW50Jywga2luZDogMX0sIHtuYW1lOiAnTWVzc2FnaW5nX0NoYXQnLCBraW5kOiA3fSwge25hbWU6ICdBdXRvZGlhbF9BZ2VudCcsIGtpbmQ6IDEyOX1dLFxuXHRcdFx0Ly8ga2luZHM6IFsxLCA3LCAxMjldLFxuXHRcdFx0c2w6IFs1LCAxMCwgMTUsIDIwLCAyNSwgMzAsIDM1LCA0MF0sXG5cdFx0XHRkYjoge30sXG5cdFx0XHR0YWJsZXM6IFtdLFxuXHRcdFx0cGVyaW9kOiAnMSBkYXknLFxuXHRcdFx0Y2F0Q29sb3VyczogW10sXG5cdFx0XHRjYXRvcmRlcjogJ2NhdGRlc2MnIC8vIGNoYW5nZWQgZHVyaW5nIHRoZSBkYXNoYm9hcmQgaW5pdGlhdGlvbiB0byB0aGUgdmFsdWUgZnJvbSB0aGUgY29uZmlnIGZpbGVcblx0XHR9LFxuXHRcdHVwZGF0ZVRpbWVvdXQgPSBudWxsO1xuXG5cdFx0dm0ub3B0aW9ucyA9IGdldERlZmF1bHRPcHRpb25zKCk7XG5cdFx0dm0uZGF0YSA9IGdldERlZmF1bHREYXRhKCk7XG5cdFx0dm0uYmVnaW4gPSB1dGlscy5wZXJpb2RUb1JhbmdlKHZtLm9wdGlvbnMucGVyaW9kKS5iZWdpbjtcblx0XHR2bS5lbmQgPSB1dGlscy5wZXJpb2RUb1JhbmdlKHZtLm9wdGlvbnMucGVyaW9kKS5lbmQ7XG5cdFx0dm0uc3RhdCA9IHt9O1xuXHRcdHZtLnByZXZzdGF0ID0ge307XG5cdFx0dm0uY2F0c3RhdCA9IFtdO1xuXHRcdHZtLmdsb2JhbENyID0ge307XG5cdFx0Ly8gdm0uY2F0VG90YWxzID0ge307XG5cdFx0Ly8gdm0uc3ViY2F0VG90YWxzID0ge307XG5cdFx0dm0uc2VsZWN0ZWRDYXQgPSBudWxsO1xuXHRcdHZtLnN1YkNhdHNTdGF0ID0gW107XG5cdFx0dm0uY2F0Y2hhcnREYXRhID0ge307XG5cdFx0dm0uY2F0Y2hhcnRMYWJlbCA9ICduY2EnO1xuXHRcdHZtLmNhdE1ldHJpY3MgPSBbeyBpbmRleDogJ25jYScsIG5hbWU6ICdOdW1iZXIgb2YgY2FsbHMgYW5zd2VyZWQnIH0sIHsgaW5kZXg6ICdhaHQnLCBuYW1lOiAnQXZlcmFnZSBoYW5kbGUgdGltZScgfSwgeyBpbmRleDogJ2F0dCcsIG5hbWU6ICdBdmVyYWdlIHRhbGsgdGltZScgfV07XG5cdFx0dm0udG90YWxCeUNhdGVnb3J5ID0ge307XG5cdFx0dm0udXNlckZ1bGxTY3JlZW4gPSAkbWRNZWRpYSgneHMnKTtcblx0XHR2bS5hYlJhdGUgPSB1dGlscy5nZXRBYmFuZG9ubWVudFJhdGU7XG5cdFx0Ly8gdm0uZ2V0RnJpZW5kbHlLaW5kID0gZ2V0RnJpZW5kbHlLaW5kO1xuXHRcdHZtLm9wZW5EYXNoU2V0dGluZ3MgPSBvcGVuRGFzaFNldHRpbmdzO1xuXHRcdHZtLm9uQ2F0U2VsZWN0ID0gb25DYXRTZWxlY3Q7XG5cdFx0dm0ub25TdWJDYXRTZWxlY3QgPSBvblN1YkNhdFNlbGVjdDtcblx0XHR2bS5nZXRTdGF0ID0gZ2V0U3RhdDtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0uZXhwb3J0RGFzaCA9IGV4cG9ydERhc2g7XG5cblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZtLm9wdGlvbnM7XG5cdFx0fSwgZnVuY3Rpb24obmV3VmFsdWUsIHByZXZWYWx1ZSkge1xuXHRcdFx0ZGVidWcubG9nKCdPcHRpb25zIGNoYW5nZWQhISEnLCBuZXdWYWx1ZSk7XG5cdFx0XHRzdG9yZS5zZXQoJ29wdGlvbnMnLCBuZXdWYWx1ZSk7XG5cdFx0fSk7XG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB2bS5jYXRjaGFydExhYmVsO1xuXHRcdH0sIGZ1bmN0aW9uKG5ld1ZhbHVlLCBwcmV2VmFsdWUpIHtcblx0XHRcdGlmKHZtLnNlbGVjdGVkQ2F0KVxuXHRcdFx0XHR2bS5jYXRjaGFydERhdGEgPSBzZXRDYXRjaGFydERhdGEodm0uc3ViQ2F0c1N0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHZtLm9wdGlvbnMuZGIudGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbik7XG5cdFx0XHRlbHNlXG5cdFx0XHRcdGlmKHZtLm9wdGlvbnMuZGIudGFibGVzKSB2bS5jYXRjaGFydERhdGEgPSBzZXRDYXRjaGFydERhdGEodm0uY2F0c3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdm0ub3B0aW9ucy5kYi50YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uKTtcblx0XHR9KTtcblx0XHQkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JHRpbWVvdXQuY2FuY2VsKHVwZGF0ZVRpbWVvdXQpO1xuXHRcdFx0dXBkYXRlVGltZW91dCA9IG51bGw7XG5cdFx0fSk7XG5cblx0XHQvLyBHZXQgREIgc2V0dGluZ3MgYW5kIGluaXQgdGhlIERhc2hib2FyZFxuXHRcdFNldHRpbmdzU2VydmljZS5nZXRTZXR0aW5ncygpXG5cdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRkZWJ1Zy5sb2coJ0RCIHNldHRpbmdzJywgZGJTZXR0aW5ncyk7XG5cdFx0XHR2YXIgdGFibGVzID0gZGJTZXR0aW5ncy50YWJsZXMsXG5cdFx0XHRcdG9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0ZGI6IGRiU2V0dGluZ3MsXG5cdFx0XHRcdFx0dGFibGVzTGlzdDogW10sXG5cdFx0XHRcdFx0Y2FsbHN0YWJsZTogdGFibGVzLmNhbGxzLFxuXHRcdFx0XHRcdGNhdHRhYmxlOiB0YWJsZXMuY2F0ZWdvcmllcyxcblx0XHRcdFx0XHRzdWJjYXR0YWJsZTogdGFibGVzLnN1YmNhdGVnb3JpZXMsXG5cdFx0XHRcdFx0Y2F0b3JkZXI6IHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25cblx0XHRcdFx0fTtcblxuXHRcdFx0YW5ndWxhci5leHRlbmQodm0ub3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0XHRhbmd1bGFyLmZvckVhY2godGFibGVzLCBmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0aWYoaXRlbS5uYW1lKSB2bS5vcHRpb25zLnRhYmxlc0xpc3QucHVzaChpdGVtLm5hbWUpO1xuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdGluaXQoKTtcblx0XHRcdGF1dG9VcGRhdGUoKTtcblx0XHR9KTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKXtcblx0XHRcdGlmKCF2bS5vcHRpb25zLmtpbmRzLmxlbmd0aCkgcmV0dXJuIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ21haW4tbG9hZGVyJyk7XG5cblx0XHRcdHZtLm9wdGlvbnMua2luZHMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpbmRleCwgYXJyYXkpIHtcblx0XHRcdFx0YXBpLmdldFRhc2tzKHsga2luZDogaXRlbS5raW5kIH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiBzZXRUYXNrcyhyZXN1bHQsIGl0ZW0pO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRcdHJldHVybiBnZXRTdGF0RGF0YSh2bS5kYXRhW2l0ZW0ubmFtZV0ubGlzdCB8fCB0YXNrcywgaXRlbSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhbGxSZXNvbHV0aW9uU3RhdCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJHEuZGVmZXIoKS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihnZXRDYXRlZ29yaWVzU3RhdClcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZihpbmRleCA9PT0gYXJyYXkubGVuZ3RoLTEpIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ21haW4tbG9hZGVyJyk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhdXRvVXBkYXRlKCl7XG5cdFx0XHR2YXIgZHVyID0gdm0ub3B0aW9ucy51cGRhdGVFdmVyeS5zcGxpdCgnICcpO1xuXHRcdFx0dXBkYXRlVGltZW91dCA9ICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZih2bS5vcHRpb25zLmF1dG91cGRhdGUpIHZtLmdldFN0YXQoKTtcblx0XHRcdFx0YXV0b1VwZGF0ZSgpO1xuXHRcdFx0fSwgbW9tZW50LmR1cmF0aW9uKHBhcnNlSW50KGR1clswXSwgMTApLCBkdXJbMV0pLl9taWxsaXNlY29uZHMpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXQoa2luZHMpIHtcblx0XHRcdHZhciBraW5kc0xpc3QgPSBraW5kcyB8fCB2bS5vcHRpb25zLmtpbmRzO1xuXHRcdFx0a2luZHNMaXN0LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5zaG93KGl0ZW0ubmFtZSsnLWxvYWRlcicpO1xuXHRcdFx0XHRnZXRTdGF0RGF0YSh2bS5kYXRhW2l0ZW0ubmFtZV0ubGlzdCwgaXRlbSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5jYWxscmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0Q2FsbFJlc29sdXRpb25TdGF0KCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAkcS5kZWZlcigpLnJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7IHNwaW5uZXJTZXJ2aWNlLmhpZGUoaXRlbS5uYW1lKyctbG9hZGVyJyk7IH0pXG5cdFx0XHRcdC5jYXRjaChmdW5jdGlvbigpeyBzcGlubmVyU2VydmljZS5oaWRlKGl0ZW0ubmFtZSsnLWxvYWRlcicpOyB9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRnZXRDYXRlZ29yaWVzU3RhdCgpO1xuXG5cdFx0XHQkbWRUb2FzdC5zaG93KFxuXHRcdFx0XHQkbWRUb2FzdC5zaW1wbGUoKVxuXHRcdFx0XHRcdC50ZXh0Q29udGVudCgnVXBkYXRpbmcgaW5kZXhlcycpXG5cdFx0XHRcdFx0LnBvc2l0aW9uKCd0b3AgcmlnaHQnKVxuXHRcdFx0XHRcdC5oaWRlRGVsYXkoMjAwMClcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlbkRhc2hTZXR0aW5ncygkZXZlbnQpIHtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQvZGFzaC1zZXR0aW5ncy5odG1sJyxcblx0XHRcdFx0Y29udHJvbGxlcjogJ0Rhc2hTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoU2V0Vm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0b3B0aW9uczogdm0ub3B0aW9uc1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnbWFpbi1sb2FkZXInKTtcblx0XHRcdFx0dm0ub3B0aW9ucyA9IHJlc3VsdC5vcHRpb25zO1xuXHRcdFx0XHRpbml0KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvbkNhdFNlbGVjdChjYXQsIGluZGV4KSB7XG5cdFx0XHRpZih2bS5zZWxlY3RlZENhdCAmJiAoIWNhdCB8fCBjYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldID09PSB2bS5zZWxlY3RlZENhdFt2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5jYXRlZ29yeV0pKSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0ID0gbnVsbDtcblx0XHRcdFx0dm0uc3ViQ2F0c1N0YXQgPSBbXTtcblx0XHRcdFx0dm0uY2F0Y2hhcnREYXRhID0gc2V0Q2F0Y2hhcnREYXRhKHZtLmNhdHN0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHZtLm9wdGlvbnMuZGIudGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGVsc2Ugdm0uc2VsZWN0ZWRDYXQgPSBjYXQ7XG5cblx0XHRcdGdldFN1YkNhdGVnb3JpZXNTdGF0KGNhdFt2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5jYXRlZ29yeV0pXG5cdFx0XHQudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0dmFyIGRhdGEgPSByZXN1bHQuZGF0YSwgdG90YWxzID0ge307XG5cdFx0XHRcdGlmKGRhdGEuZXJyb3IpIHJldHVybiBlcnJvclNlcnZpY2Uuc2hvdyhkYXRhLmVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRpZighZGF0YS5yZXN1bHQubGVuZ3RoKSByZXR1cm47XG5cblx0XHRcdFx0Ly8gdm0uc3ViY2F0VG90YWxzID0gZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscyk7XG5cdFx0XHRcdHZtLnN1YkNhdHNTdGF0ID0gc2V0Q2F0c1N0YXQoZGF0YS5yZXN1bHQsIGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpKTtcblx0XHRcdFx0dm0uY2F0Y2hhcnREYXRhID0gc2V0Q2F0Y2hhcnREYXRhKHZtLnN1YkNhdHNTdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24pO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25TdWJDYXRTZWxlY3QoY2F0LCBzdWJjYXQsIGluZGV4KSB7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRcdHRjb2xzID0gdGFibGVzLmNhbGxzLmNvbHVtbnMsXG5cdFx0XHRcdGNvbHVtbnMgPSBbdGNvbHMub3BlcmF0b3IsIHRjb2xzLmN1c3RvbWVyX3Bob25lLCB0Y29scy5jYWxsZGF0ZSwgdGNvbHMuY29tbWVudHNdLFxuXHRcdFx0XHRkYXRhO1xuXG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55KSBjb2x1bW5zLnB1c2godGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uKTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmN1c3RvbWVyX25hbWUpIGNvbHVtbnMucHVzaCh0YWJsZXMuY2FsbHMuY29sdW1ucy5jdXN0b21lcl9uYW1lKTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHQpIGNvbHVtbnMucHVzaCh0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0KTtcblxuXHRcdFx0Z2V0Q2F0UHJvY2Vzc2VzKGNvbHVtbnMsIGNhdCwgc3ViY2F0KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRkYXRhID0gcmVzdWx0LmRhdGE7XG5cdFx0XHRcdGlmKGRhdGEuZXJyb3IpIHJldHVybiBlcnJvclNlcnZpY2Uuc2hvdyhkYXRhLmVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHR2bS5wcm9jZXNzZXMgPSB1dGlscy5xdWVyeVRvT2JqZWN0KGRhdGEucmVzdWx0LCBjb2x1bW5zKTtcblx0XHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2V4cG9ydC1wcm9jZXNzZXMuaHRtbCcsXG5cdFx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLFxuXHRcdFx0XHRcdFx0ZW5kOiB2bS5lbmQsXG5cdFx0XHRcdFx0XHRkYXRhOiB2bS5wcm9jZXNzZXNcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNvbnRyb2xsZXI6ICdQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyJyxcblx0XHRcdFx0XHRjb250cm9sbGVyQXM6ICdwcm9jRXhwVm0nLFxuXHRcdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRcdGZ1bGxzY3JlZW46IHZtLnVzZXJGdWxsU2NyZWVuXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlblNldHRpbmdzKCRldmVudCwga2luZCkge1xuXHRcdFx0dmFyIGRhdGEgPSB2bS5kYXRhW2tpbmQubmFtZV07XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2tpbmQtc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdLaW5kU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAna2luZFNldFZtJyxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0a2luZDoga2luZCxcblx0XHRcdFx0XHRsaXN0OiBkYXRhLmxpc3QsXG5cdFx0XHRcdFx0dGFza3M6IGRhdGEudGFza3MsXG5cdFx0XHRcdFx0a2luZE1ldHJpY3M6IGRhdGEubWV0cmljcyxcblx0XHRcdFx0XHRtZXRyaWNzOiBkZWZhdWx0RGF0YVtraW5kLm5hbWVdLm1ldHJpY3MsXG5cdFx0XHRcdFx0c2w6IGRhdGEuc2wgfHwgbnVsbCxcblx0XHRcdFx0XHRkZWZhdWx0U0w6IHZtLm9wdGlvbnMuc2xcblx0XHRcdFx0fSxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGZ1bGxzY3JlZW46IHZtLnVzZXJGdWxsU2NyZWVuXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKG9wdHMpIHtcblx0XHRcdFx0aWYob3B0cy5zbCkgZGF0YS5zbCA9IG9wdHMuc2w7XG5cdFx0XHRcdGRhdGEubWV0cmljcyA9IG9wdHMubWV0cmljcztcblx0XHRcdFx0ZGF0YS5saXN0ID0gb3B0cy5saXN0O1xuXG5cdFx0XHRcdC8vIFVwZGF0ZSBkYXRhXG5cdFx0XHRcdHZtLmdldFN0YXQoW2tpbmRdKTtcblxuXHRcdFx0XHQvLyBTYXZlIG5ldyBkYXRhIHRvIHN0b3JhZ2Vcblx0XHRcdFx0c3RvcmUuc2V0KCdkYXRhJywgdm0uZGF0YSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleHBvcnREYXNoKCRldmVudCwga2luZHMpIHtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQvZXhwb3J0LWRpYWxvZy5odG1sJyxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0a2luZHM6IGtpbmRzIHx8IHZtLm9wdGlvbnMua2luZHMsXG5cdFx0XHRcdFx0ZGF0YTogdm0uZGF0YSxcblx0XHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0XHRcdGJlZ2luOiB2bS5iZWdpbixcblx0XHRcdFx0XHRlbmQ6IHZtLmVuZCxcblx0XHRcdFx0XHRzdGF0OiB2bS5zdGF0LFxuXHRcdFx0XHRcdHByZXZzdGF0OiB2bS5wcmV2c3RhdCxcblx0XHRcdFx0XHRjYXRzdGF0OiB2bS5jYXRzdGF0XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoRXhwb3J0Q29udHJvbGxlcicsXG5cdFx0XHRcdGNvbnRyb2xsZXJBczogJ2Rhc2hFeHBWbScsXG5cdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0RGVmYXVsdERhdGEoKXtcblx0XHRcdHZhciBkYXRhID0gc3RvcmUuZ2V0KCdkYXRhJyk7XG5cdFx0XHRpZighZGF0YSkge1xuXHRcdFx0XHRkYXRhID0gZGVmYXVsdERhdGE7XG5cdFx0XHRcdHN0b3JlLnNldCgnZGF0YScsIGRhdGEpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0RGVmYXVsdE9wdGlvbnMoKXtcblx0XHRcdHZhciBvcHRpb25zID0gc3RvcmUuZ2V0KCdvcHRpb25zJyk7XG5cdFx0XHRpZighb3B0aW9ucykge1xuXHRcdFx0XHRvcHRpb25zID0gZGVmYXVsdE9wdGlvbnM7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gb3B0aW9ucztcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRUYXNrc1N0YXRpc3RpY3MocGFyYW1zLCBvYmope1xuXHRcdFx0cmV0dXJuIGFwaS5nZXRUYXNrR3JvdXBTdGF0aXN0aWNzKHBhcmFtcykudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0dmFyIGRhdGEgPSByZXN1bHQuZGF0YTtcblxuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0aWYoZGF0YS5yZXN1bHQubGVuZ3RoKSBhbmd1bGFyLmV4dGVuZChvYmosIGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5leHRlbmRBbmRTdW0pKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXREYXRhKHRhc2tzLCBraW5kKXtcblx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0Ly8gaWYoIXRhc2tzLmxlbmd0aCkgcmV0dXJuIHJlamVjdCgpO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGN1cnJQYXJhbXMgPSB7fSxcblx0XHRcdFx0XHRwcmV2UGFyYW1zID0ge30sXG5cdFx0XHRcdFx0ZmtpbmQgPSBraW5kLm5hbWUsXG5cdFx0XHRcdFx0ZGF0YSA9IHZtLmRhdGFbZmtpbmRdLFxuXHRcdFx0XHRcdG1ldHJpY3MgPSBkYXRhLm1ldHJpY3MgfHwgdm0uZGF0YVtma2luZF0ubWV0cmljcyxcblx0XHRcdFx0XHRzbEluZGV4ID0gdXRpbHMuZ2V0U2xJbmRleChtZXRyaWNzKTtcblxuXHRcdFx0XHRjdXJyUGFyYW1zID0ge1xuXHRcdFx0XHRcdGJlZ2luOiBuZXcgRGF0ZSh2bS5iZWdpbikudmFsdWVPZigpLFxuXHRcdFx0XHRcdGVuZDogbmV3IERhdGUodm0uZW5kKS52YWx1ZU9mKCksXG5cdFx0XHRcdFx0bGlzdDogdGFza3MsXG5cdFx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGlmKGRhdGEuc2wgJiYgc2xJbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRjdXJyUGFyYW1zLm1ldHJpY3MucHVzaCgnc2wnK2RhdGEuc2wpO1xuXHRcdFx0XHR9IGVsc2UgaWYoZGF0YS5zbCAmJiBtZXRyaWNzW3NsSW5kZXhdICE9PSAnc2wnK2RhdGEuc2wpIHtcblx0XHRcdFx0XHRjdXJyUGFyYW1zLm1ldHJpY3Nbc2xJbmRleF0gPSAnc2wnK2RhdGEuc2w7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhbmd1bGFyLmV4dGVuZChwcmV2UGFyYW1zLCBjdXJyUGFyYW1zKTtcblx0XHRcdFx0cHJldlBhcmFtcy5iZWdpbiA9IGN1cnJQYXJhbXMuYmVnaW4gLSAoY3VyclBhcmFtcy5lbmQgLSBjdXJyUGFyYW1zLmJlZ2luKTtcblx0XHRcdFx0cHJldlBhcmFtcy5lbmQgPSBjdXJyUGFyYW1zLmJlZ2luO1xuXHRcdFx0XHRcblx0XHRcdFx0dm0uc3RhdFtma2luZF0gPSB0YXNrcy5sZW5ndGggPyAodm0uc3RhdFtma2luZF0gfHwge30pIDoge307XG5cdFx0XHRcdHZtLnByZXZzdGF0W2ZraW5kXSA9IHRhc2tzLmxlbmd0aCA/ICh2bS5wcmV2c3RhdFtma2luZF0gfHwge30pIDoge307XG5cblx0XHRcdFx0Z2V0VGFza3NTdGF0aXN0aWNzKGN1cnJQYXJhbXMsIHZtLnN0YXRbZmtpbmRdKS50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0cmV0dXJuIGdldFRhc2tzU3RhdGlzdGljcyhwcmV2UGFyYW1zLCB2bS5wcmV2c3RhdFtma2luZF0pO1xuXHRcdFx0XHR9KS50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2F2ZSBhcnJheSBvZiB0YXNrcyB0byBzY29wZSB2YXJpYWJsZXNcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0IC0gb2JqZWN0LCB3aGljaCBpcyByZXR1cm5lZCBmcm9tIGdldFRhc2tzIHF1ZXJ5IG9yIGFuIGFycmF5IG9mIHRhc2tzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0VGFza3MocmVzdWx0LCBraW5kKXtcblx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGEsXG5cdFx0XHRcdHRhc2tzID0gZGF0YSA/IGRhdGEucmVzdWx0IDogcmVzdWx0LFxuXHRcdFx0XHRma2luZCA9IGtpbmQubmFtZTtcblxuXHRcdFx0cmV0dXJuICRxKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdFx0XHRpZihkYXRhICYmIGRhdGEuZXJyKSByZXR1cm4gcmVqZWN0KGRhdGEuZXJyLm1lc3NhZ2UpO1xuXHRcdFx0XHRpZighdGFza3MpIHJldHVybiByZWplY3QoJ1Rhc2tzIGlzIHVuZGVmaW5lZCcpO1xuXG5cdFx0XHRcdGlmKCF2bS5kYXRhW2ZraW5kXSkge1xuXHRcdFx0XHRcdHZtLmRhdGFbZmtpbmRdID0gZGVmYXVsdERhdGEuZGVmYXVsdHM7XG5cdFx0XHRcdH1cblx0XHRcdFx0dm0uZGF0YVtma2luZF0udGFza3MgPSBbXS5jb25jYXQodGFza3MpO1xuXHRcdFx0XHRpZighdm0uZGF0YVtma2luZF0ubGlzdC5sZW5ndGgpIHZtLmRhdGFbZmtpbmRdLmxpc3QgPSBbXS5jb25jYXQodGFza3MpO1xuXG5cdFx0XHRcdHJlc29sdmUodGFza3MpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0ZWdvcmllc1N0YXQoKXtcblx0XHRcdHZhciBkYXRhLCB0YWJsZXMgPSB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdG1ldHJpY3MgPSBbJ25jYScsICdhdHQnLCAnYWh0JywgJ2FzYScsICdzbCcrdm0uZGF0YS5JbmNvbWluZ19BZ2VudC5zbF07XG5cdFx0XHRcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHQpIHtcblx0XHRcdFx0bWV0cmljcy5wdXNoKCdzdW0oY2FsbHJlc3VsdCknKTtcblx0XHRcdFx0Ly8gdm0uY2F0TWV0cmljcy5wdXNoKHsgaW5kZXg6ICdzdW0oY2FsbHJlc3VsdCknLCBuYW1lOiAnQ2FsbCByZXNvbHV0aW9uJyB9KTtcblx0XHRcdH1cblxuXHRcdFx0dm0ub3B0aW9ucy50YWJsZXNMaXN0ID0gW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lXTtcblx0XHRcdGlmKHRhYmxlcy5jb21wYW5pZXMpIHZtLm9wdGlvbnMudGFibGVzTGlzdC5wdXNoKHRhYmxlcy5jb21wYW5pZXMubmFtZSk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHQvLyB0YWJsZXM6IFsncHJvYnN0YXQnLCAncHJvYmNhdCcsICdwcm9iY29tcGFueSddLFxuXHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMudGFibGVzTGlzdCxcblx0XHRcdFx0Ly8gdGFicmVsOiAncHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iY29tcGFueT1wcm9iY29tcGFueS5jb21waWQnLFxuXHRcdFx0XHR0YWJyZWw6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdC8vICcgYW5kIHRhc2t0eXBlIGluICgnK2dldFRhc2tLaW5kcygpLmpvaW4oJywnKSsnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkJytcblx0XHRcdFx0XHRcdCh0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55ID9cblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY29tcGFuaWVzLm5hbWUsIHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5pZF0uam9pbignLicpIDpcblx0XHRcdFx0XHRcdCcnKSxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0Ly8gY29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdGRhdGEgPSByZXN1bHQuZGF0YTtcblx0XHRcdFx0aWYoIWRhdGEucmVzdWx0Lmxlbmd0aCkgcmV0dXJuIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRcdGlmKGRhdGEuZXJyb3IpIHJldHVybiBlcnJvclNlcnZpY2Uuc2hvdyhkYXRhLmVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRcblx0XHRcdFx0Ly8gdm0uY2F0VG90YWxzID0gZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscyk7XG5cdFx0XHRcdHZtLmNhdHN0YXQgPSBzZXRDYXRzU3RhdChkYXRhLnJlc3VsdCwgZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscykpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhdGVnb3JpZXNTdGF0IGNhdHN0YXQ6ICcsIHZtLmNhdHN0YXQpO1xuXHRcdFx0XHR2bS5jYXRjaGFydERhdGEgPSBzZXRDYXRjaGFydERhdGEodm0uY2F0c3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbik7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN1YkNhdGVnb3JpZXNTdGF0KGNhdCl7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRtZXRyaWNzID0gWyduY2EnLCAnYXR0JywgJ2FodCcsICdhc2EnLCAnc2wnK3ZtLmRhdGEuSW5jb21pbmdfQWdlbnQuc2xdO1xuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCkgbWV0cmljcy5wdXNoKCdzdW0oY2FsbHJlc3VsdCknKTtcblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHQvLyB0YWJsZXM6IFsncHJvYnN0YXQnLCAncHJvYmNhdCcsICdwcm9iZGV0YWlscyddLFxuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZV0sXG5cdFx0XHRcdC8vIHRhYnJlbDogJ3Byb2JjYXQuY2F0ZGVzYz1cIicrY2F0KydcIiBhbmQgcHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iZGV0YWlscz1wcm9iZGV0YWlscy5zdWJpZCcsXG5cdFx0XHRcdHRhYnJlbDogW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnPScrY2F0K1xuXHRcdFx0XHRcdFx0Ly8gJyBhbmQgdGFza3R5cGUgaW4gKCcrZ2V0VGFza0tpbmRzKCkuam9pbignLCcpKycpJytcblx0XHRcdFx0XHRcdCcgYW5kIHRhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKCkuam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQnK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWQsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKCksXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRTdWJDYXRlZ29yaWVzU3RhdCBkYXRhOiAnLCByZXN1bHQuZGF0YSk7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDYXRQcm9jZXNzZXMoY29sdW1ucywgY2F0LCBzdWJjYXQpe1xuXHRcdFx0aWYoIWNvbHVtbnMpIHJldHVybjtcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5vcHRpb25zLmRiLnRhYmxlcztcblx0XHRcdHZtLm9wdGlvbnMudGFibGVzTGlzdCA9IFt0YWJsZXMucHJvY2Vzc2VkLm5hbWUsIHRhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lXTtcblx0XHRcdGlmKHRhYmxlcy5jb21wYW5pZXMpIHZtLm9wdGlvbnMudGFibGVzTGlzdC5wdXNoKHRhYmxlcy5jb21wYW5pZXMubmFtZSk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRyZXR1cm4gYXBpLmdldFF1ZXJ5UmVzdWx0U2V0KHtcblx0XHRcdFx0Ly8gdGFibGVzOiBbJ3Byb2Nlc3NlZCcsICdwcm9ic3RhdCcsICdwcm9iY2F0JywgJ3Byb2JkZXRhaWxzJywgJ3Byb2Jjb21wYW55J10sXG5cdFx0XHRcdHRhYmxlczogdm0ub3B0aW9ucy50YWJsZXNMaXN0LFxuXHRcdFx0XHQvLyB0YWJyZWw6IChjYXQgPyAncHJvYmNhdC5jYXRkZXNjPVwiJytjYXQrJ1wiIGFuZCAnIDogJycpICsgKHN1YmNhdCA/ICdwcm9iZGV0YWlscy5wcm9iZGVzYz1cIicrc3ViY2F0KydcIiBhbmQgJyA6ICcnKSArICdwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2JkZXRhaWxzPXByb2JkZXRhaWxzLnN1YmlkIGFuZCBwcm9ic3RhdC5wcm9iY29tcGFueT1wcm9iY29tcGFueS5jb21waWQnLFxuXHRcdFx0XHR0YWJyZWw6IChjYXQgPyBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKyc9JytjYXQrJyBhbmQgJyA6ICcnKSArXG5cdFx0XHRcdFx0XHQnIHRhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKCkuam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQgJytcblx0XHRcdFx0XHRcdChzdWJjYXQgPyAnIGFuZCAnK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJz0nK3N1YmNhdCA6ICcnKSArXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdCh0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeSA/ICcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpIDogJycpK1xuXHRcdFx0XHRcdFx0KHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnkgPyAnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueV0uam9pbignLicpKyc9JytbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSA6ICcnKSxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogY29sdW1ucyxcblx0XHRcdFx0Ly8gZ3JvdXBCeTogdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tbWVudHMsXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2FsbFJlc29sdXRpb25TdGF0KCl7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsIHRhc2tLaW5kID0gMSxcblx0XHRcdG1ldHJpY3MgPSBbJ2NvdW50KGNhbGxyZXN1bHQpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdC8vIHRhYnJlbDogJ3Byb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiAndGFza2lkIGluIChcXCcnK2dldFRhc2tJZHMoW3Rhc2tLaW5kXSkuam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCdhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKSsnID0gMScsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0XSxcblx0XHRcdFx0Ly8gY29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0Q2FsbFJlc29sdXRpb25TdGF0IGRhdGE6ICcsIHJlc3VsdC5kYXRhKTtcblx0XHRcdFx0aWYocmVzdWx0LmRhdGEucmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHZtLmdsb2JhbENyW3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldID0gcmVzdWx0LmRhdGEucmVzdWx0WzBdWydjb3VudChjYWxscmVzdWx0KSddO1xuXHRcdFx0XHRcdGRlYnVnLmxvZygnZ2xvYmFsQ3I6ICcsIHZtLmdsb2JhbENyW3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldKTtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZXRDYXRzU3RhdChkYXRhLCB0b3RhbHMpe1xuXHRcdFx0dmFyIGRhdGFWYWx1ZTtcblx0XHRcdFx0Ly8gdG90YWxzID0gZGF0YS5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKTtcblxuXHRcdFx0cmV0dXJuIHV0aWxzLnNldFBlcmNlbnRhZ2VWYWx1ZXMoZGF0YSwgdG90YWxzKS5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRcdGFuZ3VsYXIuZm9yRWFjaChpdGVtLCBmdW5jdGlvbih2YWx1ZSwga2V5KXtcblx0XHRcdFx0XHRkYXRhVmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKTtcblxuXHRcdFx0XHRcdGlmKCFpc05hTihkYXRhVmFsdWUpKSBpdGVtW2tleV0gPSBkYXRhVmFsdWU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNldENhdGNoYXJ0RGF0YShhcnJheSwgZGF0YWtleSwgbGFiZWxrZXkpe1xuXHRcdFx0dmFyIG5ld0FycmF5ID0gW10sIGRhdGEgPSBbXSwgbGFiZWxzID0gW10sIGNvbG91cnMgPSBbXSwgaXRlbURhdGE7XG5cblx0XHRcdHNvcnRPYmpCeShhcnJheSwgZGF0YWtleSwgJ2Rlc2NlbmQnKVxuXHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0ZGF0YS5wdXNoKGFuZ3VsYXIuaXNOdW1iZXIoaXRlbVtkYXRha2V5XSkgPyBpdGVtW2RhdGFrZXldLnRvRml4ZWQoMikgOiBpdGVtW2RhdGFrZXldICk7XG5cdFx0XHRcdGxhYmVscy5wdXNoKGl0ZW1bbGFiZWxrZXldKTtcblx0XHRcdFx0Y29sb3Vycy5wdXNoKGdldENhdGVnb3J5Q29sb3VyKGl0ZW1bbGFiZWxrZXldKSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHRzdG9yZS5zZXQoJ29wdGlvbnMnLCB2bS5vcHRpb25zKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZGF0YTogZGF0YSxcblx0XHRcdFx0bGFiZWxzOiBsYWJlbHMsXG5cdFx0XHRcdGNvbG91cnM6IGNvbG91cnNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0ZWdvcnlDb2xvdXIoY2F0KXtcblx0XHRcdHZhciBjYXRDb2xvdXJzID0gdm0ub3B0aW9ucy5jYXRDb2xvdXJzLFxuXHRcdFx0XHRmb3VuZCA9IGZhbHNlLCBjb2xvdXIgPSAnJztcblxuXHRcdFx0Y2F0Q29sb3Vycy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdFx0XHRpZihpdGVtLm5hbWUgPT09IGNhdCkgZm91bmQgPSBpdGVtO1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmKGZvdW5kKSB7XG5cdFx0XHRcdGNvbG91ciA9IGZvdW5kLmNvbG91cjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbG91ciA9IGNvbG91ckdlbmVyYXRvci5nZXRDb2xvcigpO1xuXHRcdFx0XHR2bS5vcHRpb25zLmNhdENvbG91cnMucHVzaCh7IG5hbWU6IGNhdCwgY29sb3VyOiBjb2xvdXIgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY29sb3VyO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNvcnRPYmpCeShhcnJheSwga2V5LCBkZXNjZW5kKXtcblx0XHRcdHZhciBzb3J0ZWQgPSBhcnJheS5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuXHRcdFx0XHRpZihhW2tleV0gPiBiW2tleV0pIHJldHVybiBkZXNjZW5kID8gLTEgOiAxO1xuXHRcdFx0XHRpZihhW2tleV0gPCBiW2tleV0pIHJldHVybiBkZXNjZW5kID8gMSA6IC0xO1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHNvcnRlZDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRUYXNrS2luZHMoKXtcblx0XHRcdHJldHVybiB2bS5vcHRpb25zLmtpbmRzLm1hcChmdW5jdGlvbihpdGVtKXsgcmV0dXJuIGl0ZW0ua2luZDsgfSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0lkcyhraW5kcyl7XG5cdFx0XHR2YXIgaWRzID0gW107XG5cdFx0XHRhbmd1bGFyLmZvckVhY2godm0uZGF0YSwgZnVuY3Rpb24odmFsdWUsIGtleSl7XG5cdFx0XHRcdGlmKHZhbHVlLmxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYoa2luZHMpIHtcblx0XHRcdFx0XHRcdGlmKGtpbmRzLmluZGV4T2YodmFsdWUua2luZCkgPiAtMSkgaWRzLnB1c2godmFsdWUubGlzdCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlkcy5wdXNoKHZhbHVlLmxpc3QpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmKGlkcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGlkcy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3Vycil7XG5cdFx0XHRcdFx0cmV0dXJuIHByZXYuY29uY2F0KGN1cnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBpZHM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2Rhc2hib2FyZCcsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2Rhc2hib2FyZC5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoVm0nXG5cdFx0fSk7XG59XSk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignS2luZFNldHRpbmdzQ29udHJvbGxlcicsIEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRtZERpYWxvZycsICdraW5kJywgJ2xpc3QnLCAndGFza3MnLCAna2luZE1ldHJpY3MnLCAnbWV0cmljcycsICdzbCcsICdkZWZhdWx0U0wnXTtcblxuXHRmdW5jdGlvbiBLaW5kU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCBraW5kLCBsaXN0LCB0YXNrcywga2luZE1ldHJpY3MsIG1ldHJpY3MsIHNsLCBkZWZhdWx0U0wpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS5raW5kID0ga2luZDtcblx0XHR2bS5saXN0ID0gW10uY29uY2F0KGxpc3QpO1xuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKS5zb3J0KCk7XG5cdFx0dm0ua2luZE1ldHJpY3MgPSBbXS5jb25jYXQoa2luZE1ldHJpY3MpO1xuXHRcdHZtLm1ldHJpY3MgPSBbXS5jb25jYXQobWV0cmljcyk7XG5cdFx0dm0uc2wgPSBzbDtcblx0XHR2bS5kZWZhdWx0U0wgPSBkZWZhdWx0U0w7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5leGlzdHMgPSBleGlzdHM7XG5cdFx0dm0uc2VsZWN0QWxsVGFza3MgPSBzZWxlY3RBbGxUYXNrcztcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdHJldHVybiB2bS5saXN0Lmxlbmd0aDtcblx0XHR9LCBmdW5jdGlvbih2YWwpe1xuXHRcdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ2tpbmQgc2V0dHM6Jywgdm0ubGlzdCk7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNsOiB2bS5zbCxcblx0XHRcdFx0bWV0cmljczogdm0ua2luZE1ldHJpY3MsXG5cdFx0XHRcdGxpc3Q6IHZtLmxpc3Rcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0ubGlzdCA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLmxpc3QgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gbGlzdC5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0aWYgKGlkeCA+IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXInLCBQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyKTtcblxuXHRQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckZmlsdGVyJywgJyRtZERpYWxvZycsICd0YWJsZXMnLCAnYmVnaW4nLCAnZW5kJywgJ2RhdGEnLCAndXRpbHNTZXJ2aWNlJywgJ2RlYnVnU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIFByb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXIoJHNjb3BlLCAkZmlsdGVyLCAkbWREaWFsb2csIHRhYmxlcywgYmVnaW4sIGVuZCwgZGF0YSwgdXRpbHMsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXG5cdFx0dm0ub3JkZXIgPSB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxsZGF0ZSxcblx0XHR2bS5zZWFyY2ggPSAnJztcblx0XHR2bS5maWx0ZXIgPSB7XG5cdFx0XHRjYWxscmVzdWx0OiAnJ1xuXHRcdH07XG5cblx0XHR2bS5leHBvcnROYW1lID0gJ3Byb2Nlc3Nlcyc7XG5cdFx0Ly8gdm0uZXhwb3J0TmFtZSA9ICRmaWx0ZXIoJ2RhdGUnKSh2bS5iZWdpbiwgJ2RkLk1NLnl5JykgKyAnLScgKyAkZmlsdGVyKCdkYXRlJykodm0uZW5kLCAnZGQuTU0ueXknKTtcblxuXHRcdHZtLmNsb3NlID0gZnVuY3Rpb24oKXtcblx0XHRcdCRtZERpYWxvZy5oaWRlKCk7XG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuZGlyZWN0aXZlKCdzdGF0Q2FyZCcsIHN0YXRDYXJkKTtcblxuXHRmdW5jdGlvbiBzdGF0Q2FyZCgpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0cmVwbGFjZTogdHJ1ZSxcblx0XHRcdHNjb3BlOiB7XG5cdFx0XHRcdG1vZGVsOiAnQCcsXG5cdFx0XHRcdHRpdGxlOiAnQCcsXG5cdFx0XHRcdHN1YmhlYWQ6ICdAJyxcblx0XHRcdFx0cHJldnN0YXQ6ICdAJyxcblx0XHRcdFx0ZHluYW1pY3M6ICdAJyxcblx0XHRcdFx0Y2FyZENsYXNzOiAnQCcsXG5cdFx0XHRcdGZsZXhWYWx1ZTogJ0AnXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGVVcmw6ICdhc3NldHMvcGFydGlhbHMvY2FyZC5odG1sJ1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAnKVxuLmZpbHRlcignY29udmVydEJ5dGVzJywgZnVuY3Rpb24oKSB7XG4gIHJldHVybiBmdW5jdGlvbihpbnRlZ2VyLCBmcm9tVW5pdHMsIHRvVW5pdHMpIHtcbiAgICB2YXIgY29lZmZpY2llbnRzID0ge1xuICAgICAgICAnQnl0ZSc6IDEsXG4gICAgICAgICdLQic6IDEwMDAsXG4gICAgICAgICdNQic6IDEwMDAwMDAsXG4gICAgICAgICdHQic6IDEwMDAwMDAwMDBcbiAgICB9O1xuICAgIHJldHVybiBpbnRlZ2VyICogY29lZmZpY2llbnRzW2Zyb21Vbml0c10gLyBjb2VmZmljaWVudHNbdG9Vbml0c107XG4gIH07XG59KVxuLmZpbHRlcignYXZlcmFnZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24odmFsdWUsIG51bWJlcikge1xuXHRcdGlmKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblx0XHRcblx0XHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSkgLyAobnVtYmVyIHx8IDEpO1xuXHR9O1xufSlcbi5maWx0ZXIoJ3RpbWVyJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgZnJhY3Rpb24pIHtcblx0XHRpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cdFx0XG5cdFx0dmFyIGZpbHRlcmVkID0gcGFyc2VGbG9hdCh2YWx1ZSksXG5cdFx0XHRoaCA9IDAsIG1tID0gMCwgc3MgPSAwO1xuXG5cdFx0ZnVuY3Rpb24gcHJlcGFyZShudW1iZXIpe1xuXHRcdFx0cmV0dXJuIE1hdGguZmxvb3IobnVtYmVyKSA+IDkgPyBNYXRoLmZsb29yKG51bWJlcikgOiAnMCcrTWF0aC5mbG9vcihudW1iZXIpO1xuXHRcdH1cblxuXHRcdGhoID0gZmlsdGVyZWQgLyAzNjAwO1xuXHRcdG1tID0gKGZpbHRlcmVkICUgMzYwMCkgLyA2MDtcblx0XHRzcyA9IChtbSAlIDEpLzEwMCo2MCoxMDA7XG5cblx0XHRyZXR1cm4gcHJlcGFyZShoaCkrJzonK3ByZXBhcmUobW0pKyc6JytwcmVwYXJlKHNzKTtcblx0fTtcbn0pXG4uZmlsdGVyKCdkdXJhdGlvbicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24odmFsdWUsIGZyYWN0aW9uKSB7XG5cdFx0aWYodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXHRcdFxuXHRcdHZhciBmaWx0ZXJlZCA9IHBhcnNlRmxvYXQodmFsdWUpLFxuXHRcdFx0cHJlZml4ID0gJ3MnO1xuXG5cdFx0aWYoZmlsdGVyZWQgPiAzNjAwKSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkIC8gMzYwMDtcblx0XHRcdHByZWZpeCA9ICdoJztcblx0XHR9IGVsc2UgaWYoZmlsdGVyZWQgPiA2MCkge1xuXHRcdFx0ZmlsdGVyZWQgPSBmaWx0ZXJlZCAvIDYwO1xuXHRcdFx0cHJlZml4ID0gJ20nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyZWQudG9GaXhlZChmcmFjdGlvbiB8fCAyKSArICcgJyArIHByZWZpeDtcblx0fTtcbn0pXG4uZmlsdGVyKCdkaWZmJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihwcmV2dmFsdWUsIG5leHR2YWx1ZSwgdW5pdCkge1xuXHRcdGlmKHByZXZ2YWx1ZSA9PT0gdW5kZWZpbmVkICYmIG5leHR2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cblx0XHR2YXIgaW50UHJldlZhbHVlID0gcHJldnZhbHVlID8gcGFyc2VGbG9hdChwcmV2dmFsdWUpIDogMCxcblx0XHRcdGludE5leHRWYWx1ZSA9IG5leHR2YWx1ZSA/IHBhcnNlRmxvYXQobmV4dHZhbHVlKSA6IDAsXG5cdFx0XHRmaWx0ZXJlZCwgZGlmZiwgcHJlZml4ID0gJysnLCBkeW5hbWljcyA9IHRydWU7XG5cblx0XHRpZihpbnRQcmV2VmFsdWUgPiBpbnROZXh0VmFsdWUpIHtcblx0XHRcdGRpZmYgPSBpbnRQcmV2VmFsdWUgLSBpbnROZXh0VmFsdWU7XG5cdFx0XHRmaWx0ZXJlZCA9IGRpZmYgKiAxMDAgLyBpbnRQcmV2VmFsdWU7XG5cdFx0XHRwcmVmaXggPSAnLSc7XG5cdFx0XHRkeW5hbWljcyA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaWZmID0gaW50TmV4dFZhbHVlIC0gaW50UHJldlZhbHVlO1xuXHRcdFx0ZmlsdGVyZWQgPSBkaWZmICogMTAwIC8gaW50TmV4dFZhbHVlO1xuXHRcdH1cblxuXHRcdGlmKHVuaXQgPT09ICd2YWx1ZScpIHtcblx0XHRcdHJldHVybiBwcmVmaXgrZGlmZjtcblx0XHR9IGVsc2UgaWYodW5pdCA9PT0gJ2R5bmFtaWNzJykge1xuXHRcdFx0cmV0dXJuIGR5bmFtaWNzO1xuXHRcdH0gZWxzZSBpZih1bml0ID09PSAnZHluYW1pY3MtcmV2ZXJzZScpIHtcblx0XHRcdHJldHVybiAhZHluYW1pY3M7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBwcmVmaXgrZmlsdGVyZWQudG9GaXhlZCgxKSsnJSc7XG5cdFx0fVxuXHR9O1xufSlcbi5maWx0ZXIoJ2R5bmFtaWNzJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZTEsIHZhbHVlMikge1xuXHRcdGlmKHZhbHVlMSA9PT0gdW5kZWZpbmVkICYmIHZhbHVlMiA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cblx0XHRyZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZTEpID4gcGFyc2VGbG9hdCh2YWx1ZTIpID8gJ3Bvc2l0aXZlJyA6ICduZWdhdGl2ZSc7XG5cdH07XG59KTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdMYXlvdXRDb250cm9sbGVyJywgTGF5b3V0Q29udHJvbGxlcik7XG5cblx0TGF5b3V0Q29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJ107XG5cblx0ZnVuY3Rpb24gTGF5b3V0Q29udHJvbGxlcigkcm9vdFNjb3BlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0XG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2FwaVNlcnZpY2UnLCBhcGlTZXJ2aWNlKTtcblxuICAgIGFwaVNlcnZpY2UuJGluamVjdCA9IFsnJGh0dHAnLCAnYXBwQ29uZmlnJywgJ2Vycm9yU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gYXBpU2VydmljZSgkaHR0cCwgYXBwQ29uZmlnLCBlcnJvclNlcnZpY2Upe1xuXG4gICAgICAgIHZhciBiYXNlVXJsID0gYXBwQ29uZmlnLnNlcnZlcjtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0RGJTZXR0aW5nczogZ2V0RGJTZXR0aW5ncyxcbiAgICAgICAgICAgIGdldFRhc2tzOiBnZXRUYXNrcyxcbiAgICAgICAgICAgIGdldFRhc2tHcm91cFN0YXRpc3RpY3M6IGdldFRhc2tHcm91cFN0YXRpc3RpY3MsXG4gICAgICAgICAgICBnZXRDdXN0b21MaXN0U3RhdGlzdGljczogZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3MsXG4gICAgICAgICAgICBnZXRRdWVyeVJlc3VsdFNldDogZ2V0UXVlcnlSZXN1bHRTZXRcblxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldERiU2V0dGluZ3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc3RhdC9kYi5qc29uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrcyhwYXJhbXMsIGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFRhc2tzJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrR3JvdXBTdGF0aXN0aWNzKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRUYXNrR3JvdXBTdGF0aXN0aWNzJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRDdXN0b21MaXN0U3RhdGlzdGljcyhwYXJhbXMpIHtcbiAgICAgICAgICAgIHZhciByZXFQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFF1ZXJ5UmVzdWx0U2V0KHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRRdWVyeVJlc3VsdFNldCcsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIHF1ZXJ5OiBbJ1NFTEVDVCcsIHBhcmFtcy5jb2x1bW5zLCAnRlJPTScsIHBhcmFtcy50YWJsZXMsICdXSEVSRScsICdwcm9jZXNzZWQucHJvY2lkPScrcGFyYW1zLnByb2NpZCwgJ2FuZCcsIHBhcmFtcy50YWJyZWwsICdhbmQgdGltZXN0YXJ0IGJldHdlZW4nLCBtb21lbnQocGFyYW1zLmJlZ2luKS51bml4KCksICdhbmQnLCBtb21lbnQocGFyYW1zLmVuZCkudW5peCgpLCAocGFyYW1zLmdyb3VwQnkgPyAnZ3JvdXAgYnkgJytwYXJhbXMuZ3JvdXBCeSA6ICcnKV0uam9pbignICcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2NvbG91ckdlbmVyYXRvcicsIGNvbG91ckdlbmVyYXRvcik7XG5cbiAgICBmdW5jdGlvbiBjb2xvdXJHZW5lcmF0b3IoKXtcblxuICAgICAgICAvLyBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9yYW5kb20tbWF0ZXJpYWwtY29sb3JcblxuICAgICAgICB2YXIgZGVmYXVsdFBhbGV0dGUgPSB7XG4gICAgICAgICAgICAvLyBSZWQsIFBpbmssIFB1cnBsZSwgRGVlcCBQdXJwbGUsIEluZGlnbywgQmx1ZSwgTGlnaHQgQmx1ZSwgQ3lhbiwgVGVhbCwgR3JlZW4sIExpZ2h0IEdyZWVuLCBMaW1lLCBZZWxsb3csIEFtYmVyLCBPcmFuZ2UsIERlZXAgT3JhbmdlLCBCcm93biwgR3JleSwgQmx1ZSBHcmV5XG4gICAgICAgICAgICAnNTAnOiBbJyNGRkVCRUUnLCAnI0ZDRTRFQycsICcjRjNFNUY1JywgJyNFREU3RjYnLCAnI0U4RUFGNicsICcjRTNGMkZEJywgJyNFMUY1RkUnLCAnI0UwRjdGQScsICcjRTBGMkYxJywgJyNFOEY1RTknLCAnI0YxRjhFOScsICcjRjlGQkU3JywgJyNGRkZERTcnLCAnI0ZGRjhFMScsICcjRkZGM0UwJywgJyNGQkU5RTcnLCAnI0VGRUJFOScsICcjRkFGQUZBJywgJyNFQ0VGRjEnXSxcbiAgICAgICAgICAgICcxMDAnOiBbJyNGRkNERDInLCAnI0Y4QkJEMCcsICcjRTFCRUU3JywgJyNEMUM0RTknLCAnI0M1Q0FFOScsICcjQkJERUZCJywgJyNCM0U1RkMnLCAnI0IyRUJGMicsICcjQjJERkRCJywgJyNDOEU2QzknLCAnI0RDRURDOCcsICcjRjBGNEMzJywgJyNGRkY5QzQnLCAnI0ZGRUNCMycsICcjRkZFMEIyJywgJyNGRkNDQkMnLCAnI0Q3Q0NDOCcsICcjRjVGNUY1JywgJyNDRkQ4REMnXSxcbiAgICAgICAgICAgICcyMDAnOiBbJyNFRjlBOUEnLCAnI0Y0OEZCMScsICcjQ0U5M0Q4JywgJyNCMzlEREInLCAnIzlGQThEQScsICcjOTBDQUY5JywgJyM4MUQ0RkEnLCAnIzgwREVFQScsICcjODBDQkM0JywgJyNBNUQ2QTcnLCAnI0M1RTFBNScsICcjRTZFRTlDJywgJyNGRkY1OUQnLCAnI0ZGRTA4MicsICcjRkZDQzgwJywgJyNGRkFCOTEnLCAnI0JDQUFBNCcsICcjRUVFRUVFJywgJyNCMEJFQzUnXSxcbiAgICAgICAgICAgICczMDAnOiBbJyNFNTczNzMnLCAnI0YwNjI5MicsICcjQkE2OEM4JywgJyM5NTc1Q0QnLCAnIzc5ODZDQicsICcjNjRCNUY2JywgJyM0RkMzRjcnLCAnIzRERDBFMScsICcjNERCNkFDJywgJyM4MUM3ODQnLCAnI0FFRDU4MScsICcjRENFNzc1JywgJyNGRkYxNzYnLCAnI0ZGRDU0RicsICcjRkZCNzREJywgJyNGRjhBNjUnLCAnI0ExODg3RicsICcjRTBFMEUwJywgJyM5MEE0QUUnXSxcbiAgICAgICAgICAgICc0MDAnOiBbJyNFRjUzNTAnLCAnI0VDNDA3QScsICcjQUI0N0JDJywgJyM3RTU3QzInLCAnIzVDNkJDMCcsICcjNDJBNUY1JywgJyMyOUI2RjYnLCAnIzI2QzZEQScsICcjMjZBNjlBJywgJyM2NkJCNkEnLCAnIzlDQ0M2NScsICcjRDRFMTU3JywgJyNGRkVFNTgnLCAnI0ZGQ0EyOCcsICcjRkZBNzI2JywgJyNGRjcwNDMnLCAnIzhENkU2MycsICcjQkRCREJEJywgJyM3ODkwOUMnXSxcbiAgICAgICAgICAgICc1MDAnOiBbJyNGNDQzMzYnLCAnI0U5MUU2MycsICcjOUMyN0IwJywgJyM2NzNBQjcnLCAnIzNGNTFCNScsICcjMjE5NkYzJywgJyMwM0E5RjQnLCAnIzAwQkNENCcsICcjMDA5Njg4JywgJyM0Q0FGNTAnLCAnIzhCQzM0QScsICcjQ0REQzM5JywgJyNGRkVCM0InLCAnI0ZGQzEwNycsICcjRkY5ODAwJywgJyNGRjU3MjInLCAnIzc5NTU0OCcsICcjOUU5RTlFJywgJyM2MDdEOEInXSxcbiAgICAgICAgICAgICc2MDAnOiBbJyNFNTM5MzUnLCAnI0Q4MUI2MCcsICcjOEUyNEFBJywgJyM1RTM1QjEnLCAnIzM5NDlBQicsICcjMUU4OEU1JywgJyMwMzlCRTUnLCAnIzAwQUNDMScsICcjMDA4OTdCJywgJyM0M0EwNDcnLCAnIzdDQjM0MicsICcjQzBDQTMzJywgJyNGREQ4MzUnLCAnI0ZGQjMwMCcsICcjRkI4QzAwJywgJyNGNDUxMUUnLCAnIzZENEM0MScsICcjNzU3NTc1JywgJyM1NDZFN0EnXSxcbiAgICAgICAgICAgICc3MDAnOiBbJyNEMzJGMkYnLCAnI0MyMTg1QicsICcjN0IxRkEyJywgJyM1MTJEQTgnLCAnIzMwM0Y5RicsICcjMTk3NkQyJywgJyMwMjg4RDEnLCAnIzAwOTdBNycsICcjMDA3OTZCJywgJyMzODhFM0MnLCAnIzY4OUYzOCcsICcjQUZCNDJCJywgJyNGQkMwMkQnLCAnI0ZGQTAwMCcsICcjRjU3QzAwJywgJyNFNjRBMTknLCAnIzVENDAzNycsICcjNjE2MTYxJywgJyM0NTVBNjQnXSxcbiAgICAgICAgICAgICc4MDAnOiBbJyNDNjI4MjgnLCAnI0FEMTQ1NycsICcjNkExQjlBJywgJyM0NTI3QTAnLCAnIzI4MzU5MycsICcjMTU2NUMwJywgJyMwMjc3QkQnLCAnIzAwODM4RicsICcjMDA2OTVDJywgJyMyRTdEMzInLCAnIzU1OEIyRicsICcjOUU5RDI0JywgJyNGOUE4MjUnLCAnI0ZGOEYwMCcsICcjRUY2QzAwJywgJyNEODQzMTUnLCAnIzRFMzQyRScsICcjNDI0MjQyJywgJyMzNzQ3NEYnXSxcbiAgICAgICAgICAgICc5MDAnOiBbJyNCNzFDMUMnLCAnIzg4MEU0RicsICcjNEExNDhDJywgJyMzMTFCOTInLCAnIzFBMjM3RScsICcjMEQ0N0ExJywgJyMwMTU3OUInLCAnIzAwNjA2NCcsICcjMDA0RDQwJywgJyMxQjVFMjAnLCAnIzMzNjkxRScsICcjODI3NzE3JywgJyNGNTdGMTcnLCAnI0ZGNkYwMCcsICcjRTY1MTAwJywgJyNCRjM2MEMnLCAnIzNFMjcyMycsICcjMjEyMTIxJywgJyMyNjMyMzgnXSxcbiAgICAgICAgICAgICdBMTAwJzogWycjRkY4QTgwJywgJyNGRjgwQUInLCAnI0VBODBGQycsICcjQjM4OEZGJywgJyM4QzlFRkYnLCAnIzgyQjFGRicsICcjODBEOEZGJywgJyM4NEZGRkYnLCAnI0E3RkZFQicsICcjQjlGNkNBJywgJyNDQ0ZGOTAnLCAnI0Y0RkY4MScsICcjRkZGRjhEJywgJyNGRkU1N0YnLCAnI0ZGRDE4MCcsICcjRkY5RTgwJ10sXG4gICAgICAgICAgICAnQTIwMCc6IFsnI0ZGNTI1MicsICcjRkY0MDgxJywgJyNFMDQwRkInLCAnIzdDNERGRicsICcjNTM2REZFJywgJyM0NDhBRkYnLCAnIzQwQzRGRicsICcjMThGRkZGJywgJyM2NEZGREEnLCAnIzY5RjBBRScsICcjQjJGRjU5JywgJyNFRUZGNDEnLCAnI0ZGRkYwMCcsICcjRkZENzQwJywgJyNGRkFCNDAnLCAnI0ZGNkU0MCddLFxuICAgICAgICAgICAgJ0E0MDAnOiBbJyNGRjE3NDQnLCAnI0Y1MDA1NycsICcjRDUwMEY5JywgJyM2NTFGRkYnLCAnIzNENUFGRScsICcjMjk3OUZGJywgJyMwMEIwRkYnLCAnIzAwRTVGRicsICcjMURFOUI2JywgJyMwMEU2NzYnLCAnIzc2RkYwMycsICcjQzZGRjAwJywgJyNGRkVBMDAnLCAnI0ZGQzQwMCcsICcjRkY5MTAwJywgJyNGRjNEMDAnXSxcbiAgICAgICAgICAgICdBNzAwJzogWycjRDUwMDAwJywgJyNDNTExNjInLCAnI0FBMDBGRicsICcjNjIwMEVBJywgJyMzMDRGRkUnLCAnIzI5NjJGRicsICcjMDA5MUVBJywgJyMwMEI4RDQnLCAnIzAwQkZBNScsICcjMDBDODUzJywgJyM2NEREMTcnLCAnI0FFRUEwMCcsICcjRkZENjAwJywgJyNGRkFCMDAnLCAnI0ZGNkQwMCcsICcjREQyQzAwJ11cbiAgICAgICAgfTtcblxuICAgICAgICAvKiB1c2VkQ29sb3JzID0gW3sgdGV4dDpTb21lVGV4dCwgY29sb3I6IFNvbWVDb2xvciB9XSAqL1xuICAgICAgICB2YXIgdXNlZENvbG9ycyA9IFtdO1xuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBzaGFkZXM6IFsnNTAnLCAnMTAwJywgJzIwMCcsICczMDAnLCAnNDAwJywgJzUwMCcsICc2MDAnLCAnNzAwJywgJzgwMCcsICc5MDAnLCAnQTEwMCcsICdBMjAwJywgJ0E0MDAnLCAnQTcwMCddLFxuICAgICAgICAgICAgcGFsZXR0ZTogZGVmYXVsdFBhbGV0dGUsXG4gICAgICAgICAgICB0ZXh0OiBudWxsLFxuICAgICAgICAgICAgaWdub3JlQ29sb3JzOiBbXVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXRDb2xvcjogZ2V0Q29sb3JcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBnZXRDb2xvcihvcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25zIHx8IChvcHRpb25zID0gZGVmYXVsdE9wdGlvbnMpO1xuICAgICAgICAgICAgb3B0aW9ucy5wYWxldHRlIHx8IChvcHRpb25zLnBhbGV0dGUgPSBkZWZhdWx0UGFsZXR0ZSk7XG4gICAgICAgICAgICBvcHRpb25zLnNoYWRlcyB8fCAob3B0aW9ucy5zaGFkZXMgPSBbJzUwMCddKTtcblxuICAgICAgICAgICAgdmFyIGwgPSB1c2VkQ29sb3JzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjb2xvcjtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy50ZXh0ICYmIHVzZWRDb2xvcnNbaV0udGV4dCA9PT0gb3B0aW9ucy50ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1c2VkQ29sb3JzW2ldLmNvbG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29sb3IgPSBwaWNrQ29sb3Iob3B0aW9ucyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnRleHQpIHtcbiAgICAgICAgICAgICAgICB1c2VkQ29sb3JzLnB1c2goe3RleHQ6IG9wdGlvbnMudGV4dCwgY29sb3I6IGNvbG9yfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb2xvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHBpY2tDb2xvcihvcHRpb25zKSB7XG4gICAgICAgICAgICB2YXIgc2hhZGUgPSBvcHRpb25zLnNoYWRlc1tnZXRSYW5kb21JbnQob3B0aW9ucy5zaGFkZXMubGVuZ3RoKV07XG4gICAgICAgICAgICB2YXIgY29sb3IgPSAnJztcblxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG9wdGlvbnMucGFsZXR0ZSkge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnBhbGV0dGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBrZXkgPT09IHNoYWRlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yID0gb3B0aW9ucy5wYWxldHRlW2tleV1bZ2V0UmFuZG9tSW50KG9wdGlvbnMucGFsZXR0ZVtrZXldLmxlbmd0aCldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbG9yO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0UmFuZG9tSW50KG1heCkge1xuICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXgpKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnZGVidWdTZXJ2aWNlJywgZGVidWdTZXJ2aWNlKTtcblxuICAgIGRlYnVnU2VydmljZS4kaW5qZWN0ID0gWyckbG9nJywgJ3N0b3JlJywgJ2Vycm9yU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gZGVidWdTZXJ2aWNlKCRsb2csIHN0b3JlLCBlcnJvclNlcnZpY2Upe1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBsb2c6IGZ1bmN0aW9uKG1lc3NhZ2UpeyBsb2coYXJndW1lbnRzLCAnbG9nJyk7IH0sXG4gICAgICAgICAgICBpbmZvOiBmdW5jdGlvbihtZXNzYWdlKXsgbG9nKGFyZ3VtZW50cywgJ2luZm8nKTsgfSxcbiAgICAgICAgICAgIHdhcm46IGZ1bmN0aW9uKG1lc3NhZ2UpeyBsb2coYXJndW1lbnRzLCAnd2FybicpOyB9LFxuICAgICAgICAgICAgZXJyb3I6IGVycm9yU2VydmljZS5zaG93XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gbG9nKGFyZ3MsIG1ldGhvZCl7XG4gICAgICAgICAgICBpZihzdG9yZS5nZXQoJ2RlYnVnJykpIHtcbiAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwoYXJncywgZnVuY3Rpb24oYXJnKXtcbiAgICAgICAgICAgICAgICAgICAgJGxvZ1ttZXRob2RdKGFyZyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdlcnJvclNlcnZpY2UnLCBlcnJvclNlcnZpY2UpO1xuXG4gICAgZXJyb3JTZXJ2aWNlLiRpbmplY3QgPSBbXTtcblxuICAgIGZ1bmN0aW9uIGVycm9yU2VydmljZSgpe1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzaG93OiBzaG93XG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gc2hvdyhlcnJvcil7XG4gICAgICAgICAgICByZXR1cm4gY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAvLyAkdHJhbnNsYXRlKCdFUlJPUlMuJytlcnJvcilcbiAgICAgICAgICAgIC8vIC50aGVuKGZ1bmN0aW9uICh0cmFuc2xhdGlvbil7XG4gICAgICAgICAgICAvLyAgICAgaWYoJ0VSUk9SUy4nK2Vycm9yID09PSB0cmFuc2xhdGlvbikge1xuICAgICAgICAgICAgLy8gICAgICAgICBub3RpZmljYXRpb25zLnNob3dFcnJvcignRVJST1JfT0NDVVJSRUQnKTtcbiAgICAgICAgICAgIC8vICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gICAgICAgICBub3RpZmljYXRpb25zLnNob3dFcnJvcih0cmFuc2xhdGlvbik7XG4gICAgICAgICAgICAvLyAgICAgfVxuICAgICAgICAgICAgLy8gfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ1NldHRpbmdzU2VydmljZScsIFNldHRpbmdzU2VydmljZSk7XG5cbiAgICBTZXR0aW5nc1NlcnZpY2UuJGluamVjdCA9IFsnJHEnLCAnYXBpU2VydmljZScsICdlcnJvclNlcnZpY2UnXTtcblxuICAgIGZ1bmN0aW9uIFNldHRpbmdzU2VydmljZSgkcSwgYXBpLCBlcnJvclNlcnZpY2Upe1xuXG4gICAgICAgIHZhciBzZXR0aW5ncyA9IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldFNldHRpbmdzOiBnZXRTZXR0aW5nc1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgLy8gR2V0IERCIHNldHRpbmdzIGZyb20gY2FjaGUgb3IgSlNPTiBmaWxlXG4gICAgICAgIGZ1bmN0aW9uIGdldFNldHRpbmdzKCkge1xuICAgICAgICAgICAgcmV0dXJuICRxKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIGlmKHNldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYXBpLmdldERiU2V0dGluZ3MoKVxuICAgICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKGRiU2V0dGluZ3Mpe1xuICAgICAgICAgICAgICAgICAgICBzZXR0aW5ncyA9IGRiU2V0dGluZ3MuZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyKXtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnVGFza3NTZXJ2aWNlJywgVGFza3NTZXJ2aWNlKTtcblxuICAgIFRhc2tzU2VydmljZS4kaW5qZWN0ID0gWydhcGlTZXJ2aWNlJywgJ2Vycm9yU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gVGFza3NTZXJ2aWNlKGFwaSwgZXJyb3JTZXJ2aWNlKXtcblxuICAgICAgICB2YXIgdGFza3MgPSBbXG4gICAgICAgICAgICB7bmFtZTogJ0luY29taW5nX0FnZW50Jywga2luZDogMX0sXG4gICAgICAgICAgICB7bmFtZTogJ01lc3NhZ2luZ19DaGF0Jywga2luZDogN30sXG4gICAgICAgICAgICB7bmFtZTogJ0F1dG9kaWFsX0FnZW50Jywga2luZDogMTI5fVxuICAgICAgICBdO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXRUYXNrczogZ2V0VGFza3MsXG4gICAgICAgICAgICBnZXRUYXNrTGlzdDogZ2V0VGFza0xpc3RcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGZ1bmN0aW9uIGdldFRhc2tzKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRhc2tzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VGFza0xpc3QoaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBhcGkuZ2V0VGFza3MoeyBraW5kOiBpZCB9KTtcbiAgICAgICAgfVxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ3V0aWxzU2VydmljZScsIHV0aWxzU2VydmljZSk7XG5cbiAgICAvLyB1dGlsc1NlcnZpY2UuJGluamVjdCA9IFtdO1xuXG4gICAgZnVuY3Rpb24gdXRpbHNTZXJ2aWNlKCl7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldFRvdGFsczogZ2V0VG90YWxzLFxuICAgICAgICAgICAgc2V0UGVyY2VudGFnZVZhbHVlczogc2V0UGVyY2VudGFnZVZhbHVlcyxcbiAgICAgICAgICAgIGdldEFiYW5kb25tZW50UmF0ZTogZ2V0QWJhbmRvbm1lbnRSYXRlLFxuICAgICAgICAgICAgZ2V0U2xJbmRleDogZ2V0U2xJbmRleCxcbiAgICAgICAgICAgIGdldEZyaWVuZGx5S2luZDogZ2V0RnJpZW5kbHlLaW5kLFxuICAgICAgICAgICAgZXh0ZW5kQW5kU3VtOiBleHRlbmRBbmRTdW0sXG4gICAgICAgICAgICBxdWVyeVRvT2JqZWN0OiBxdWVyeVRvT2JqZWN0LFxuICAgICAgICAgICAgcGVyaW9kVG9SYW5nZTogcGVyaW9kVG9SYW5nZSxcbiAgICAgICAgICAgIGZpbHRlckJ5S2V5OiBmaWx0ZXJCeUtleSxcbiAgICAgICAgICAgIGZpbHRlclVuaXF1ZTogZmlsdGVyVW5pcXVlXG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VG90YWxzKHByZXYsIG5leHQpe1xuICAgICAgICAgICAgdmFyIHRvdGFscyA9IHt9O1xuICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gcHJldil7XG4gICAgICAgICAgICAgICAgaWYoIWlzTmFOKHBhcnNlRmxvYXQocHJldltrZXldKSkgJiYgIWlzTmFOKHBhcnNlRmxvYXQobmV4dFtrZXldKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWxzW2tleV0gPSBwYXJzZUZsb2F0KHByZXZba2V5XSkgKyBwYXJzZUZsb2F0KG5leHRba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvdGFscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNldFBlcmNlbnRhZ2VWYWx1ZXMoZGF0YSwgdG90YWxzKXtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gaXRlbSl7XG4gICAgICAgICAgICAgICAgICAgIGlmKHRvdGFscy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtW2tleSsnX3AnXSA9IChpdGVtW2tleV0gLyB0b3RhbHNba2V5XSAqIDEwMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEFiYW5kb25tZW50UmF0ZShuY28sIG5jYSl7XG4gICAgICAgICAgICByZXR1cm4gbmNhICogMTAwIC8gbmNvO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U2xJbmRleChhcnJheSl7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSAtMTtcbiAgICAgICAgICAgIGFycmF5LmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSkge1xuICAgICAgICAgICAgICAgIGlmKC9ec2wvLnRlc3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RnJpZW5kbHlLaW5kKGtpbmQpe1xuICAgICAgICAgICAgdmFyIGZraW5kID0gJyc7XG4gICAgICAgICAgICBzd2l0Y2ggKGtpbmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIGZraW5kID0gJ0luY29taW5nX0FnZW50JztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgICAgICAgICBma2luZCA9ICdNZXNzYWdpbmdfQ2hhdCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTI5OlxuICAgICAgICAgICAgICAgICAgICBma2luZCA9ICdBdXRvZGlhbF9BZ2VudCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZraW5kID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZraW5kO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXh0ZW5kQW5kU3VtKG9iajEsIG9iajIsIGluZGV4LCBhcnJheSl7XG4gICAgICAgICAgICB2YXIga2V5LCB2YWwxLCB2YWwyO1xuICAgICAgICAgICAgZm9yKCBrZXkgaW4gb2JqMiApIHtcbiAgICAgICAgICAgICAgICBpZiggb2JqMi5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbDEgPSBhbmd1bGFyLmlzVW5kZWZpbmVkKG9iajFba2V5XSkgPyAwIDogb2JqMVtrZXldO1xuICAgICAgICAgICAgICAgICAgICB2YWwyID0gYW5ndWxhci5pc1VuZGVmaW5lZChvYmoyW2tleV0pID8gMCA6IHBhcnNlRmxvYXQob2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYoIWlzTmFOKHZhbDIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb3VudCBzdW0gYW5kIGZpbmQgYXZlcmFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldID0gYW5ndWxhci5pc051bWJlcih2YWwxKSA/ICh2YWwxICsgdmFsMikgOiAocGFyc2VGbG9hdCh2YWwxKSArIHZhbDIpLnRvRml4ZWQoMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZihpbmRleCA9PT0gYXJyYXkubGVuZ3RoLTEpIG9iajFba2V5XSA9IG9iajFba2V5XSAvIGFycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGFuZ3VsYXIuaXNBcnJheShvYmoxW2tleV0pKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwdXNoIHRvIHRoZSBhcnJheSBvZiBzdHJpbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldLnB1c2gob2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgbmV3IGFycmF5IGFuZCBhZGQgdmFsdWVzIHRvIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldID0gW10uY29uY2F0KG9iajFba2V5XSwgb2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmoxO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcXVlcnlUb09iamVjdChkYXRhLCBrZXlzKXtcbiAgICAgICAgICAgIHZhciBvYmosIGtleTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgb2JqID0ge307XG4gICAgICAgICAgICAgICAgaXRlbS5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwZXJpb2RUb1JhbmdlKHBlcmlvZCl7XG4gICAgICAgICAgICB2YXIgYXJyID0gcGVyaW9kLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGJlZ2luOiBtb21lbnQoKS5zdGFydE9mKGFyclsxXSkudG9EYXRlKCksXG4gICAgICAgICAgICAgICAgZW5kOiBtb21lbnQoKS5lbmRPZihhcnJbMV0pLnRvRGF0ZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gcmV0dXJuIG1vbWVudCgpLnN1YnRyYWN0KGFyclswXSwgYXJyWzFdKS50b0RhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGZpbHRlckJ5S2V5KG9iamVjdCwga2V5KXtcbiAgICAgICAgICAgIHJldHVybiBvYmplY3Rba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGZpbHRlclVuaXF1ZShpdGVtLCBpbmRleCwgYXJyYXkpe1xuICAgICAgICAgICAgaWYoYXJyYXkuaW5kZXhPZihpdGVtKSA9PT0gLTEpIHJldHVybiBpdGVtO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAnKVxuXHRcdC5jb250cm9sbGVyKCdTcGlubmVyQ29udHJvbGxlcicsIFNwaW5uZXJDb250cm9sbGVyKTtcblxuXHRTcGlubmVyQ29udHJvbGxlci4kaW5qZWN0ID0gWydzcGlubmVyU2VydmljZScsICckc2NvcGUnXTtcblxuXHRmdW5jdGlvbiBTcGlubmVyQ29udHJvbGxlcihzcGlubmVyU2VydmljZSwgJHNjb3BlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgc2hvdWxkIGJlIHRydWUgYnkgZGVmYXVsdCBpZiBub3Qgc3BlY2lmaWVkLlxuXHRcdGlmICghdm0uaGFzT3duUHJvcGVydHkoJ3JlZ2lzdGVyJykpIHtcblx0XHRcdHZtLnJlZ2lzdGVyID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dm0ucmVnaXN0ZXIgPSB2bS5yZWdpc3Rlci50b0xvd2VyQ2FzZSgpID09PSAnZmFsc2UnID8gZmFsc2UgOiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIERlY2xhcmUgYSBtaW5pLUFQSSB0byBoYW5kIG9mZiB0byBvdXIgc2VydmljZSBzbyB0aGUgc2VydmljZVxuXHRcdC8vIGRvZXNuJ3QgaGF2ZSBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhpcyBkaXJlY3RpdmUncyBzY29wZS5cblx0XHR2YXIgYXBpID0ge1xuXHRcdFx0bmFtZTogdm0ubmFtZSxcblx0XHRcdGdyb3VwOiB2bS5ncm91cCxcblx0XHRcdHNob3c6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm0uc2hvdyA9IHRydWU7XG5cdFx0XHR9LFxuXHRcdFx0aGlkZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2bS5zaG93ID0gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0dG9nZ2xlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZtLnNob3cgPSAhdm0uc2hvdztcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gUmVnaXN0ZXIgdGhpcyBzcGlubmVyIHdpdGggdGhlIHNwaW5uZXIgc2VydmljZS5cblx0XHRpZiAodm0ucmVnaXN0ZXIgPT09IHRydWUpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdzcGlubmVyOiAnLCBhcGkpO1xuXHRcdFx0c3Bpbm5lclNlcnZpY2UuX3JlZ2lzdGVyKGFwaSk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgYW4gb25TaG93IG9yIG9uSGlkZSBleHByZXNzaW9uIHdhcyBwcm92aWRlZCwgcmVnaXN0ZXIgYSB3YXRjaGVyXG5cdFx0Ly8gdGhhdCB3aWxsIGZpcmUgdGhlIHJlbGV2YW50IGV4cHJlc3Npb24gd2hlbiBzaG93J3MgdmFsdWUgY2hhbmdlcy5cblx0XHRpZiAodm0ub25TaG93IHx8IHZtLm9uSGlkZSkge1xuXHRcdFx0JHNjb3BlLiR3YXRjaCgnc2hvdycsIGZ1bmN0aW9uIChzaG93KSB7XG5cdFx0XHRcdGlmIChzaG93ICYmIHZtLm9uU2hvdykge1xuXHRcdFx0XHRcdHZtLm9uU2hvdyh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFzaG93ICYmIHZtLm9uSGlkZSkge1xuXHRcdFx0XHRcdHZtLm9uSGlkZSh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBUaGlzIHNwaW5uZXIgaXMgZ29vZCB0byBnby4gRmlyZSB0aGUgb25Mb2FkZWQgZXhwcmVzc2lvbi5cblx0XHRpZiAodm0ub25Mb2FkZWQpIHtcblx0XHRcdHZtLm9uTG9hZGVkKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcCcpXG5cdFx0LmRpcmVjdGl2ZSgnc3Bpbm5lcicsIHNwaW5uZXIpO1xuXG5cdGZ1bmN0aW9uIHNwaW5uZXIoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHJlcGxhY2U6IHRydWUsXG5cdFx0XHR0cmFuc2NsdWRlOiB0cnVlLFxuXHRcdFx0c2NvcGU6IHtcblx0XHRcdFx0bmFtZTogJ0A/Jyxcblx0XHRcdFx0Z3JvdXA6ICdAPycsXG5cdFx0XHRcdHNob3c6ICdAPycsXG5cdFx0XHRcdGltZ1NyYzogJ0A/Jyxcblx0XHRcdFx0cmVnaXN0ZXI6ICdAPycsXG5cdFx0XHRcdG9uTG9hZGVkOiAnJj8nLFxuXHRcdFx0XHRvblNob3c6ICcmPycsXG5cdFx0XHRcdG9uSGlkZTogJyY/J1xuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiBbXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwic3Bpbm5lci1sb2FkZXIgYW5pbWF0ZS1zaG93XCIgbmctc2hvdz1cInNob3dcIj4nLFxuXHRcdFx0XHQnICA8aW1nIG5nLWlmPVwiaW1nU3JjXCIgbmctc3JjPVwie3tpbWdTcmN9fVwiIC8+Jyxcblx0XHRcdFx0JyAgPG5nLXRyYW5zY2x1ZGU+PC9uZy10cmFuc2NsdWRlPicsXG5cdFx0XHRcdCc8L2Rpdj4nXG5cdFx0XHRdLmpvaW4oJycpLFxuXHRcdFx0Y29udHJvbGxlcjogWyAnJHNjb3BlJywgJ3NwaW5uZXJTZXJ2aWNlJywgZnVuY3Rpb24oJHNjb3BlLCBzcGlubmVyU2VydmljZSkge1xuXHRcdFx0XHQvLyByZWdpc3RlciBzaG91bGQgYmUgdHJ1ZSBieSBkZWZhdWx0IGlmIG5vdCBzcGVjaWZpZWQuXG5cdFx0XHRcdGlmICghJHNjb3BlLmhhc093blByb3BlcnR5KCdyZWdpc3RlcicpKSB7XG5cdFx0XHRcdFx0JHNjb3BlLnJlZ2lzdGVyID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQkc2NvcGUucmVnaXN0ZXIgPSAkc2NvcGUucmVnaXN0ZXIudG9Mb3dlckNhc2UoKSA9PT0gJ2ZhbHNlJyA/IGZhbHNlIDogdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERlY2xhcmUgYSBtaW5pLUFQSSB0byBoYW5kIG9mZiB0byBvdXIgc2VydmljZSBzbyB0aGUgc2VydmljZVxuXHRcdFx0XHQvLyBkb2Vzbid0IGhhdmUgYSBkaXJlY3QgcmVmZXJlbmNlIHRvIHRoaXMgZGlyZWN0aXZlJ3Mgc2NvcGUuXG5cdFx0XHRcdHZhciBhcGkgPSB7XG5cdFx0XHRcdFx0bmFtZTogJHNjb3BlLm5hbWUsXG5cdFx0XHRcdFx0Z3JvdXA6ICRzY29wZS5ncm91cCxcblx0XHRcdFx0XHRzaG93OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9IHRydWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRoaWRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9IGZhbHNlO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dG9nZ2xlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHQkc2NvcGUuc2hvdyA9ICEkc2NvcGUuc2hvdztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gUmVnaXN0ZXIgdGhpcyBzcGlubmVyIHdpdGggdGhlIHNwaW5uZXIgc2VydmljZS5cblx0XHRcdFx0aWYgKCRzY29wZS5yZWdpc3RlciA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdzcGlubmVyOiAnLCBhcGkpO1xuXHRcdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLl9yZWdpc3RlcihhcGkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgYW4gb25TaG93IG9yIG9uSGlkZSBleHByZXNzaW9uIHdhcyBwcm92aWRlZCwgcmVnaXN0ZXIgYSB3YXRjaGVyXG5cdFx0XHRcdC8vIHRoYXQgd2lsbCBmaXJlIHRoZSByZWxldmFudCBleHByZXNzaW9uIHdoZW4gc2hvdydzIHZhbHVlIGNoYW5nZXMuXG5cdFx0XHRcdGlmICgkc2NvcGUub25TaG93IHx8ICRzY29wZS5vbkhpZGUpIHtcblx0XHRcdFx0XHQkc2NvcGUuJHdhdGNoKCdzaG93JywgZnVuY3Rpb24gKHNob3cpIHtcblx0XHRcdFx0XHRcdGlmIChzaG93ICYmICRzY29wZS5vblNob3cpIHtcblx0XHRcdFx0XHRcdFx0JHNjb3BlLm9uU2hvdyh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICghc2hvdyAmJiAkc2NvcGUub25IaWRlKSB7XG5cdFx0XHRcdFx0XHRcdCRzY29wZS5vbkhpZGUoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRoaXMgc3Bpbm5lciBpcyBnb29kIHRvIGdvLiBGaXJlIHRoZSBvbkxvYWRlZCBleHByZXNzaW9uLlxuXHRcdFx0XHRpZiAoJHNjb3BlLm9uTG9hZGVkKSB7XG5cdFx0XHRcdFx0JHNjb3BlLm9uTG9hZGVkKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdzcGlubmVyU2VydmljZScsIHNwaW5uZXJTZXJ2aWNlKTtcblxuICAgIGZ1bmN0aW9uIHNwaW5uZXJTZXJ2aWNlKCl7XG5cbiAgICAgICAgdmFyIHNwaW5uZXJzID0ge307XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgX3JlZ2lzdGVyOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGlmICghZGF0YS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiU3Bpbm5lciBtdXN0IHNwZWNpZnkgYSBuYW1lIHdoZW4gcmVnaXN0ZXJpbmcgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzcGlubmVycy5oYXNPd25Qcm9wZXJ0eShkYXRhLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiQSBzcGlubmVyIHdpdGggdGhlIG5hbWUgJ1wiICsgZGF0YS5uYW1lICsgXCInIGhhcyBhbHJlYWR5IGJlZW4gcmVnaXN0ZXJlZC5cIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcGlubmVyc1tkYXRhLm5hbWVdID0gZGF0YTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzaG93OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBzcGlubmVyID0gc3Bpbm5lcnNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFzcGlubmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobmV3IEVycm9yKFwiTm8gc3Bpbm5lciBuYW1lZCAnXCIgKyBuYW1lICsgXCInIGlzIHJlZ2lzdGVyZWQuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3Bpbm5lci5zaG93KCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaGlkZTogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3Bpbm5lciA9IHNwaW5uZXJzW25hbWVdO1xuICAgICAgICAgICAgICAgIGlmICghc3Bpbm5lcikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBzcGlubmVyIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgcmVnaXN0ZXJlZC5cIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNwaW5uZXIuaGlkZSgpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNob3dBbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBuYW1lIGluIHNwaW5uZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIHNwaW5uZXJzW25hbWVdLnNob3coKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaGlkZUFsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc3Bpbm5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lcnNbbmFtZV0uaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5kaXJlY3RpdmUoJ3NpZGVNZW51Jywgc2lkZU1lbnUpO1xuXG5cdGZ1bmN0aW9uIHNpZGVNZW51KCl7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBRScsXG5cdFx0XHR0cmFuc2NsdWRlOiB0cnVlLFxuXHRcdFx0Y29udHJvbGxlcjogJ1NpZGVtZW51Q29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdzaWRlbWVudVZtJyxcblx0XHRcdHRlbXBsYXRlVXJsOiAnbGF5b3V0L3NpZGVtZW51L3NpZGVtZW51Lmh0bWwnXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAubGF5b3V0Jylcblx0XHQuY29udHJvbGxlcignU2lkZW1lbnVDb250cm9sbGVyJywgU2lkZW1lbnVDb250cm9sbGVyKTtcblxuXHRTaWRlbWVudUNvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckbWRTaWRlbmF2J107XG5cblx0ZnVuY3Rpb24gU2lkZW1lbnVDb250cm9sbGVyKCRyb290U2NvcGUsICRtZFNpZGVuYXYpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dm0uaXNPcGVuID0gZmFsc2U7XG5cblx0XHQkcm9vdFNjb3BlLiRvbignJHJvdXRlQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYodm0uaXNPcGVuKSBcblx0XHRcdFx0JG1kU2lkZW5hdignc2lkZW5hdicpLnRvZ2dsZSgpO1xuXHRcdH0pO1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdUb3BiYXJDb250cm9sbGVyJywgVG9wYmFyQ29udHJvbGxlcik7XG5cblx0VG9wYmFyQ29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJywgJyRzY29wZScsICckbWRTaWRlbmF2J107XG5cblx0ZnVuY3Rpb24gVG9wYmFyQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkc2NvcGUsICRtZFNpZGVuYXYpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS50b2dnbGVTaWRlbWVudSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0JG1kU2lkZW5hdignc2lkZW5hdicpLnRvZ2dsZSgpO1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmRpcmVjdGl2ZSgndG9wQmFyJywgdG9wQmFyKTtcblxuXHRmdW5jdGlvbiB0b3BCYXIoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRjb250cm9sbGVyOiAnVG9wYmFyQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICd0b3BiYXJWbScsXG5cdFx0XHR0ZW1wbGF0ZVVybDogJ2xheW91dC90b3BiYXIvdG9wYmFyLmh0bWwnLFxuXHRcdH07XG5cblx0fVxuXG59KSgpOyJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
