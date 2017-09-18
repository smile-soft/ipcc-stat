angular.module('app', [
	'app.core',
	'app.config',
	'app.routes',
	'app.layout',
	'app.crr',
	'app.qos',
	'app.companies',
	'app.fcr',
	'app.dashboard'
]);
angular.module('app.companies', [
	'app.core'
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
angular.module('app.qos', [
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
		.module('app.companies')
		.controller('CompSettingsController', CompSettingsController);

	CompSettingsController.$inject = ['$scope', '$mdDialog', 'sl', 'debugService'];

	function CompSettingsController($scope, $mdDialog, sl, debug) {

		var vm = this;

		vm.sl = sl;
		vm.sls = [5, 10, 15, 20, 25, 30, 35, 40];
		vm.save = save;
		vm.close = closeSettings;

		function save() {
			$mdDialog.hide({
				sl: vm.sl
			});
		}

		function closeSettings() {
			$mdDialog.cancel();
		}

	}

})();
(function(){

	'use strict';

	angular
		.module('app.companies')
		.controller('CompaniesController', CompaniesController);

	CompaniesController.$inject = ['$scope', '$mdDialog', '$mdMedia', 'apiService', 'spinnerService', 'SettingsService', 'chartService', 'utilsService', 'debugService', 'errorService'];

	function CompaniesController($scope, $mdDialog, $mdMedia, api, spinnerService, SettingsService, chartService, utils, debug, errorService) {

		var vm = this;
		var defaults = {
			period: '1 month'
		};

		vm.sl = 20;
		vm.settings = {};
		vm.stat = [];
		vm.chartData = {};
		vm.chartOptions = {
			// responsive: false,
			// scales: {
			// 	yAxes: [{
			// 		display: false
			// 	}],
			// 	xAxes: [{
			// 		display: false
			// 	}]
			// },
			// legend: {
			// 	display: false
			// }
		};
		vm.chartLabel = 'nco';
		vm.chartMetrics = [{ index: 'nco', name: 'Number of calls offered' }, { index: 'nca', name: 'Number of calls answered' }, { index: 'aht', name: 'Average handle time' }, { index: 'att', name: 'Average talk time' }];
		vm.begin = utils.periodToRange(defaults.period).begin;
		vm.end = utils.periodToRange(defaults.period).end;
		vm.tableSort = '-nco';
		vm.getCompaniesStat = getCompaniesStat;
		vm.openSettings = openSettings;
		vm.onCompSelect = onCompSelect;
		vm.userFullScreen = $mdMedia('xs');
		

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return getCompaniesStat();
			})
			.then(function() {
				$scope.$watch(function() {
					return vm.chartLabel;
				}, function(newValue, prevValue) {
					vm.chartData = chartService.setChartData(vm.stat, vm.chartLabel, vm.settings.tables.companies.columns.description, vm.chartLabel);
				});
			})
			.catch(errorService.show);
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'companies/comp-settings.html',
				controller: 'CompSettingsController',
				controllerAs: 'compSettsVm',
				parent: angular.element(document.body),
				locals: {
					sl: vm.sl
				}
			}).then(function(result) {
				vm.sl = result.sl;
				getCompaniesStat();
			});
		}

		function getCompaniesStat(){
			var tables = vm.settings.tables;
			var tablesList = [tables.calls.name, tables.companies.name];
			var metrics = ['aht', 'att', 'nco', 'nca', 'car', 'asa', 'sl'+vm.sl];

			spinnerService.show('companies-loader');

			return api.getCustomListStatistics({
				tables: tablesList,
				tabrel: [tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.'),
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.company, tables.companies.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(function(response) {
				
				debug.log('getCompaniesStat: ', response, response.data);

				spinnerService.hide('companies-loader')

				if(response.data.error) return errorService.show(response.data.error.message);
				vm.stat = response.data.result.length ? addPercentageValues(response.data.result, response.data.result.reduce(utils.getTotals)) : [];
				vm.chartData = chartService.setChartData(vm.stat, vm.chartLabel, tables.companies.columns.description, vm.chartLabel);
				
			})
			.catch(errorService.show);

		}

		function onCompSelect(item) {
			debug.log('onCompSelect: ', item);

			spinnerService.show('companies-loader');
			
			var tables = vm.settings.tables;
			var columnsAlias = {
				agent: [tables.calls.name, tables.calls.columns.operator].join('.'),
				phone: [tables.calls.name, tables.calls.columns.customer_phone].join('.'),
				date: [tables.calls.name, tables.calls.columns.calldate].join('.'),
				comment: [tables.calls.name, tables.calls.columns.comments].join('.')
			},
			columns, columnsKeys;

			var tablesList = [tables.processed.name, tables.calls.name];
			if(tables.companies) tablesList.push(tables.companies.name);

			if(tables.calls.columns.company) columnsAlias.description = [tables.companies.name, tables.companies.columns.description].join('.');
			if(tables.calls.columns.customer_name) columnsAlias.cname = [tables.calls.name, tables.calls.columns.customer_name].join('.');
			if(tables.calls.columns.callresult) columnsAlias.callresult = [tables.calls.name, tables.calls.columns.callresult].join('.');

			columns = Object.keys(columnsAlias).map(function(key) { return columnsAlias[key]; });
			columnsKeys = Object.keys(columnsAlias).map(function(key) { return key; });

			return api.getQueryResultSet({
				tables: tablesList,
				tabrel: [tables.calls.name, tables.calls.columns.company].join('.')+'='+item[tables.calls.columns.company]+
						' and '+[tables.calls.name, tables.calls.columns.operator].join('.')+'=processed.agentid '+				
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.process_id].join('.')+'=processed.procid',
				columns: Object.keys(columns).map(function(key) { return columns[key]; }),
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			}).then(function(response){
				spinnerService.hide('companies-loader');
				
				var processes = utils.queryToObject(response.data.result, columnsKeys);

				$mdDialog.show({
					templateUrl: 'dashboard/export-processes.html',
					locals: {
						tables: vm.settings.tables,
						begin: vm.begin,
						end: vm.end,
						data: processes
					},
					controller: 'ProcessesExportController',
					controllerAs: 'procExpVm',
					parent: angular.element(document.body),
					fullscreen: vm.userFullScreen
				});

				debug.log('onCompSelect result: ', response);
			});
		}

		function addPercentageValues(data, totals){
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

	}

})();
angular.module('app.companies')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/companies', {
			templateUrl: 'companies/companies.html',
			controller: 'CompaniesController',
			controllerAs: 'compVm'
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

	CrrController.$inject = ['$rootScope', '$mdDialog', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function CrrController($rootScope, $mdDialog, SettingsService, api, store, TasksService, utils, debug, spinnerService, errorService) {

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
		vm.data = store.get('data');

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				return getTaskList(vm.data);
				// return TasksService.getTaskList(1);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks);
				vm.tasks = tasks;
				vm.selectedTasks = tasks;
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
				debug.log('selectedTasks: ', vm.selectedTasks);
				perfStat = pstat.data.result;
				vm.stat = angular.merge([], agentStat, perfStat);
				vm.stat.map(addPerfValue);

				return api.getFCRStatistics({
					task: vm.selectedTasks,
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
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
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
				tabrel: 'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
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

		function getTaskList(data) {
			var tasks = [];
			Object.keys(data).forEach(function(item) {
				tasks = tasks.concat(data[item].tasks);
			});
			return tasks;
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
			Callback_Agent: {
				kind: 257,
				tasks: [],
				list: [],
				sl: 20,
				metrics: ['aht', 'att', 'nco', 'nca', 'car', 'asa']
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
			kindsList: [{name: 'Incoming_Agent', kind: 1}, {name: 'Messaging_Chat', kind: 7}, {name: 'Autodial_Agent', kind: 129}, {name: 'Callback_Agent', kind: 257}],
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
						return getCallResolutionStat(item);
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio(item);
					} else {
						return $q.defer().resolve();
					}
				})
				// .then(function() {
				// 	if(vm.options.cattable) {
				// 		return getCategoriesStat();
				// 	} else {
				// 		return $q.defer().resolve();
				// 	}
				// })
				.then(function() {
					getGlobalFrc(item, 'init');
				})
				.then(function(){
					if(index === array.length-1) spinnerService.hide('main-loader');
				})
				.catch(errorService.show);
			});

			if(vm.options.cattable) getCategoriesStat();
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
						return getCallResolutionStat(item);
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					if(vm.options.callstable && vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio(item);
					} else {
						return $q.defer().resolve();
					}
				})
				.then(function() {
					getGlobalFrc(item, 'getStat');
				})
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
				columnsAlias = {
					agent: [tables.calls.name, tcols.operator].join('.'), 
					phone: [tables.calls.name, tcols.customer_phone].join('.'), 
					date: [tables.calls.name, tcols.calldate].join('.'), 
					comment: [tables.calls.name, tcols.comments].join('.')
				},
				columns, columnsKeys, data;

			if(tables.calls.columns.company) columnsAlias.description = [tables.companies.name, tables.companies.columns.description].join('.');
			if(tables.calls.columns.customer_name) columnsAlias.cname = [tables.calls.name, tables.calls.columns.customer_name].join('.');
			if(tables.calls.columns.callresult) columnsAlias.callresult = [tables.calls.name, tables.calls.columns.callresult].join('.');

			columns = Object.keys(columnsAlias).map(function(key) { return columnsAlias[key]; });
			columnsKeys = Object.keys(columnsAlias).map(function(key) { return key; });

			getCatProcesses(columns, cat, subcat).then(function(result) {
				data = result.data;
				if(data.error) return errorService.show(data.error.message);
				vm.processes = utils.queryToObject(data.result, columnsKeys);
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

				store.set('data', vm.data);

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

		function getCallResolutionStat(kind){
			var data, tables = vm.options.db.tables, taskKind = kind.kind,
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

		function getGlobalFrc(kind, func) {
			var tables = vm.options.db.tables,
				taskKind = kind.kind,
				tasks = getTaskIds([taskKind]);

			debug.log('getGlobalFrc tasks:', kind, func);

			return api.getCustomFCRStatistics({
				task: tasks,
				// task: tasks[0],
				// table: [tables.calls.name],
				// procid: tables.calls.columns.process_id,
				interval: 3600*24*1000,
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf()
			})
			.then(function(result) {
				vm.globalFcr[kind.name] = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.globalFcr[kind.name].fcrRate = vm.globalFcr[kind.name].fcr / vm.globalFcr[kind.name].total * 100;

				debug.log('getGlobalFrc: ', vm.globalFcr);

				// get prev statistics
				return api.getCustomFCRStatistics({
					task: tasks,
					// table: [tables.calls.name],
					// procid: tables.calls.columns.process_id,
					interval: 3600*24*1000,
					begin: (vm.begin.valueOf() - (vm.end.valueOf() - vm.begin.valueOf())),
					end: vm.begin.valueOf()
				});

			})
			.then(function(result) {
				vm.prevGlobalFcr[kind.name] = result.data.result.length ? (result.data.result
				.reduce(utils.extendAndSum)) : [];
				
				vm.prevGlobalFcr[kind.name].fcrRate = vm.prevGlobalFcr[kind.name].fcr / vm.prevGlobalFcr[kind.name].total * 100;

				debug.log('prevGlobalFcr: ', vm.prevGlobalFcr);
			})
		}

		function getLoginsRatio(kind) {
			var data, tables = vm.options.db.tables, taskKind = kind.kind,
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

		function arrayToIn(array) {
			return "('" + array.join("','") + "')";
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

		vm.order = 'date';
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
angular.module('app.fcr')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/fcr', {
			templateUrl: 'fcr/fcr.html',
			controller: 'FcrController',
			controllerAs: 'fcrVm'
		});
}]);
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
.filter('tsToDate', function() {
	return function(ts) {
		if(!ts) return;
		var date = new Date(ts*1000).toLocaleString();
		console.log('tsToDate: ', date);
		return date;
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
		.module('app.qos')
		.controller('QosSettingsController', QosSettingsController);

	QosSettingsController.$inject = ['$scope', '$mdDialog', 'tasks', 'selectedTasks', 'debugService'];

	function QosSettingsController($scope, $mdDialog, tasks, selectedTasks, debug) {

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
		.module('app.qos')
		.controller('QosController', QosController);

	QosController.$inject = ['$rootScope', '$mdDialog', 'SettingsService', 'apiService', 'store', 'TasksService', 'utilsService', 'debugService', 'spinnerService', 'errorService'];

	function QosController($rootScope, $mdDialog, SettingsService, api, store, TasksService, utils, debug, spinnerService, errorService) {

		var vm = this;
		var defaultOptions = {
			period: '1 day'
		};
		var perfStat = [];
		var agentStat = [];
		var agentsFcr = {};
		
		vm.settings = {};
		vm.tasks = [];
		vm.selectedTasks = [];
		vm.stat = [];
		vm.statAvg = [];
		vm.totalAvg = {};
		vm.columns = {};
		vm.qnum = [];
		vm.begin = utils.periodToRange(defaultOptions.period).begin;
		vm.end = utils.periodToRange(defaultOptions.period).end;
		vm.getStat = getStat;
		vm.getAvgStat = getAvgStat;
		vm.openSettings = openSettings;
		vm.tableSort = '';
		vm.tableAvgSort = 'agent';
		vm.data = store.get('data');

		init();
		spinnerService.hide('main-loader');

		function init() {
			SettingsService.getSettings()
			.then(function(dbSettings){
				vm.settings = dbSettings;
				vm.columns = getColumns();
				
				return getTaskList(vm.data);
			})
			.then(function(tasks) {
				debug.log('tasks: ', tasks);
				vm.tasks = tasks;
				vm.selectedTasks = tasks;
			})
			.then(getStat)
			.catch(errorService.show);
		}

		function openSettings($event) {
			$mdDialog.show({
				targetEvent: $event,
				templateUrl: 'qos/qos-settings.html',
				controller: 'QosSettingsController',
				controllerAs: 'qosSettsVm',
				parent: angular.element(document.body),
				locals: {
					tasks: vm.tasks,
					selectedTasks: vm.selectedTasks
				}
			}).then(function(result) {
				vm.selectedTasks = result.selectedTasks;
				getStat();
			});
		}

		function getColumns() {
			var tables = vm.settings.tables;
			return {
				procid: [tables.qoscheck.name, tables.qoscheck.columns.procid].join('.'),
				date: [tables.qoscheck.name, tables.qoscheck.columns.callstamp].join('.'),
				task: [tables.processed.name, 'taskid'].join('.'),
				agent: [tables.qoscheck.name, tables.qoscheck.columns.opername].join('.'),
				phone: [tables.qoscheck.name, tables.qoscheck.columns.phone].join('.'),
				category: [tables.categories.name, tables.categories.columns.description].join('.'),
				subcategory: [tables.subcategories.name, tables.subcategories.columns.description].join('.'),
				company: [tables.companies.name, tables.companies.columns.description].join('.'),
				question: [tables.qoscheck_answers.name, tables.qoscheck_answers.columns.quenum].join('.'),
				answer: [tables.qoscheck_answers.name, tables.qoscheck_answers.columns.answer].join('.'),
				comment: [tables.qoscheck.name, tables.qoscheck.columns.result].join('.')
			};
		}

		function getStat() {
			var tables = vm.settings.tables;
			var metrics = [];

			vm.tableSort = 'date';

			spinnerService.show('qos-loader');
			spinnerService.show('qos-avg-loader');

			return api.getCustomListStatistics({
				tables: [tables.calls.name, tables.categories.name, tables.subcategories.name, tables.companies.name, tables.qoscheck.name, tables.qoscheck_answers.name],
				tabrel: 
						'taskid in (\''+vm.selectedTasks.join('\',\'')+'\')'+
						' and '+[tables.calls.name, tables.calls.columns.category].join('.')+'='+[tables.categories.name, tables.categories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.subcategory].join('.')+'='+[tables.subcategories.name, tables.subcategories.columns.id].join('.')+
						' and '+[tables.calls.name, tables.calls.columns.company].join('.')+'='+[tables.companies.name, tables.companies.columns.id].join('.')+
						' and '+[tables.qoscheck.name, tables.qoscheck.columns.procid].join('.')+'='+[tables.qoscheck_answers.name, tables.qoscheck_answers.columns.procid].join('.'),
				procid: [tables.qoscheck.name, tables.qoscheck.columns.procid].join('.'),
				columns: Object.keys(vm.columns).map(function(key) { return vm.columns[key]; }),
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			})
			.then(showStat)
			.catch(errorService.show);

		}

		function showStat(response) {
			var stat = [];
			var data = response.data.result;
			var columns = vm.columns;
			// var question = {};

			if(data.length) {
				// to object
				stat = data.reduce(function(prev, next) {
					if(!prev[next[columns.procid]]) {
						prev[next[columns.procid]] = next;

					}
					prev[next[columns.procid]].date = next[columns.date];
					prev[next[columns.procid]].task = next[columns.task];
					prev[next[columns.procid]].agent = next[columns.agent];
					prev[next[columns.procid]].phone = next[columns.phone];
					prev[next[columns.procid]].category = next[columns.category];
					prev[next[columns.procid]].subcategory = next[columns.subcategory];
					prev[next[columns.procid]].company = next[columns.company];
					prev[next[columns.procid]].comment = next[columns.comment];
					prev[next[columns.procid]].questions = prev[next[columns.procid]].questions || {};
					prev[next[columns.procid]].questions[next[columns.question]] = parseFloat(next[columns.answer]) || 0;

					// prev[next[columns.procid]].questions.push(question);

					return prev;
				}, {});

				// back to array
				stat = Object.keys(stat).map(function(key) {
					return stat[key];
				});
			}

			vm.stat = stat;
			vm.qnum = stat.length ? Object.keys(stat[0].questions) : [];

			getAvgStat();

			spinnerService.hide('qos-loader');
			spinnerService.hide('qos-avg-loader');

			debug.log('showStat stat: ', stat);
		}

		function getAvgStat() {
			var columns = vm.columns;
			var item = {};
			var totalAvg = {};
			var statAvg = vm.stat.reduce(function(prev, next) {
				prev[next[columns.agent]] = prev[next[columns.agent]] || {};
				item = prev[next[columns.agent]];
				item.agent = next[columns.agent];
				item.questions = item.questions || {};
				Object.keys(next.questions).forEach(function(key) {
					item.questions[key] = item.questions[key] ? (item.questions[key] + next.questions[key]) : next.questions[key];
					totalAvg[key] = totalAvg[key] ? (totalAvg[key] + next.questions[key]) : next.questions[key];
				});
				item.count = item.count ? (item.count+1) : 1;

				return prev;
			}, {});

			// back to array
			statAvg = Object.keys(statAvg).map(function(key) {
				return statAvg[key];
			});

			vm.statAvg = statAvg;
			vm.totalAvg = totalAvg;

			debug.log('getAvgStat: ', statAvg, totalAvg);

		}

		function getTaskList(data) {
			var tasks = [];
			Object.keys(data).forEach(function(item) {
				tasks = tasks.concat(data[item].tasks);
			});
			return tasks;
		}

	}

})();
angular.module('app.qos')
.config(['$routeProvider', function($routeProvider){

	$routeProvider.
		when('/qos', {
			templateUrl: 'qos/qos.html',
			controller: 'QosController',
			controllerAs: 'qosVm'
		});
}]);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFwcC5jb21wYW5pZXMuanMiLCJhcHAuY29uZmlnLmpzIiwiYXBwLmNvcmUuanMiLCJhcHAuY3JyLmpzIiwiYXBwLmRhc2hib2FyZC5qcyIsImFwcC5mY3IuanMiLCJhcHAubGF5b3V0LmpzIiwiYXBwLnFvcy5qcyIsImFwcC5yb3V0ZXMuanMiLCJjb21wYW5pZXMvY29tcC1zZXR0aW5ncy5jb250cm9sbGVyLmpzIiwiY29tcGFuaWVzL2NvbXBhbmllcy5jb250cm9sbGVyLmpzIiwiY29tcGFuaWVzL2NvbXBhbmllcy5yb3V0ZS5qcyIsImNyci9jcnItc2V0dGluZ3MuY29udHJvbGxlci5qcyIsImNyci9jcnIuY29udHJvbGxlci5qcyIsImNyci9jcnIucm91dGUuanMiLCJkYXNoYm9hcmQvZGFzaGJvYXJkLWV4cG9ydC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC1zZXR0aW5ncy5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS5qcyIsImRhc2hib2FyZC9raW5kLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvcHJvY2Vzc2VzLWV4cG9ydC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL3N0YXQtY2FyZC5kaXJlY3RpdmUuanMiLCJmY3IvZmNyLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJmY3IvZmNyLmNvbnRyb2xsZXIuanMiLCJmY3IvZmNyLnJvdXRlLmpzIiwibGF5b3V0L2xheW91dC5jb250cm9sbGVyLmpzIiwic2VydmljZXMvYXBpLmpzIiwic2VydmljZXMvY2hhcnQuanMiLCJzZXJ2aWNlcy9jb2xvdXItZ2VuLmpzIiwic2VydmljZXMvZGVidWcuanMiLCJzZXJ2aWNlcy9lcnJvci5qcyIsInNlcnZpY2VzL3NldHRpbmdzLmpzIiwic2VydmljZXMvdGFza3MuanMiLCJzZXJ2aWNlcy91dGlscy5qcyIsImZpbHRlcnMvZmlsdGVycy5qcyIsInFvcy9xb3Mtc2V0dGluZ3MuY29udHJvbGxlci5qcyIsInFvcy9xb3MuY29udHJvbGxlci5qcyIsInFvcy9xb3MuanMiLCJsYXlvdXQvc2lkZW1lbnUvc2lkZS1tZW51LmRpcmVjdGl2ZS5qcyIsImxheW91dC9zaWRlbWVudS9zaWRlbWVudS5jb250cm9sbGVyLmpzIiwibGF5b3V0L3RvcGJhci90b3AtYmFyLmNvbnRyb2xsZXIuanMiLCJsYXlvdXQvdG9wYmFyL3RvcC1iYXIuZGlyZWN0aXZlLmpzIiwiY29tcG9uZW50cy9kYXRlcGlja2VyL3BpY2tlci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvX19zcGlubmVyLmNvbnRyb2xsZXIuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5zZXJ2aWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNWQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNQQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2x2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNVhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN01BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFsbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImFuZ3VsYXIubW9kdWxlKCdhcHAnLCBbXG5cdCdhcHAuY29yZScsXG5cdCdhcHAuY29uZmlnJyxcblx0J2FwcC5yb3V0ZXMnLFxuXHQnYXBwLmxheW91dCcsXG5cdCdhcHAuY3JyJyxcblx0J2FwcC5xb3MnLFxuXHQnYXBwLmNvbXBhbmllcycsXG5cdCdhcHAuZmNyJyxcblx0J2FwcC5kYXNoYm9hcmQnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNvbXBhbmllcycsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5jb25maWcnLCBbXG5cdCdhcHAuY29yZSdcbl0pXG4uY29uc3RhbnQoJ2FwcENvbmZpZycsIHtcblx0c2VydmVyOiB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgKyAnLy8nICsgd2luZG93LmxvY2F0aW9uLmhvc3Rcbn0pXG4uY29uZmlnKFsnJGNvbXBpbGVQcm92aWRlcicsIGZ1bmN0aW9uICgkY29tcGlsZVByb3ZpZGVyKSB7XG4gICRjb21waWxlUHJvdmlkZXIuZGVidWdJbmZvRW5hYmxlZChmYWxzZSk7XG59XSlcbi5jb25maWcoWydDaGFydEpzUHJvdmlkZXInLGZ1bmN0aW9uKENoYXJ0SnNQcm92aWRlcikge1xuXHRDaGFydEpzUHJvdmlkZXIuc2V0T3B0aW9ucyh7XG5cdFx0bGVnZW5kVGVtcGxhdGUgOiBcIjx1bCBjbGFzcz1cXFwiY3VzdG9tLWxlZ2VuZCA8JT1uYW1lLnRvTG93ZXJDYXNlKCklPi1sZWdlbmRcXFwiPjwlIGZvciAodmFyIGk9MDsgaTxzZWdtZW50cy5sZW5ndGg7IGkrKyl7JT48bGk+PHNwYW4gc3R5bGU9XFxcImJhY2tncm91bmQtY29sb3I6PCU9c2VnbWVudHNbaV0uZmlsbENvbG9yJT5cXFwiPjwvc3Bhbj48JWlmKHNlZ21lbnRzW2ldLmxhYmVsKXslPjwlPXNlZ21lbnRzW2ldLmxhYmVsJT48JX0lPjwvbGk+PCV9JT48L3VsPlwiXG5cdH0pO1xufV0pO1xuXG4vLyAuY29uZmlnKFsnJG1kVGhlbWluZ1Byb3ZpZGVyJyxmdW5jdGlvbigkbWRUaGVtaW5nUHJvdmlkZXIpIHtcbi8vIFx0JG1kVGhlbWluZ1Byb3ZpZGVyLnRoZW1lKCdjeWFuJyk7XG4vLyB9XSlcbi8vIC5jb25maWcoWyckdHJhbnNsYXRlUHJvdmlkZXInLCBmdW5jdGlvbigkdHJhbnNsYXRlUHJvdmlkZXIpIHtcbi8vIFx0JHRyYW5zbGF0ZVByb3ZpZGVyLnVzZVN0YXRpY0ZpbGVzTG9hZGVyKHtcbi8vIFx0XHRwcmVmaXg6ICcvdHJhbnNsYXRpb25zL2xvY2FsZS0nLFxuLy8gXHRcdHN1ZmZpeDogJy5qc29uJ1xuLy8gXHR9KTtcbi8vIFx0JHRyYW5zbGF0ZVByb3ZpZGVyLnByZWZlcnJlZExhbmd1YWdlKCdlbicpO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIuZmFsbGJhY2tMYW5ndWFnZSgnZW4nKTtcbi8vIFx0JHRyYW5zbGF0ZVByb3ZpZGVyLnVzZVN0b3JhZ2UoJ3N0b3JhZ2UnKTtcbi8vIFx0JHRyYW5zbGF0ZVByb3ZpZGVyLnVzZVNhbml0aXplVmFsdWVTdHJhdGVneSgnc2FuaXRpemVQYXJhbWV0ZXJzJyk7XG4vLyBcdC8vICR0cmFuc2xhdGVQcm92aWRlci51c2VTYW5pdGl6ZVZhbHVlU3RyYXRlZ3koJ2VzY2FwZScpO1xuLy8gfV0pXG4vLyAuY29uZmlnKFsndG1oRHluYW1pY0xvY2FsZVByb3ZpZGVyJywgZnVuY3Rpb24odG1oRHluYW1pY0xvY2FsZVByb3ZpZGVyKSB7XG4vLyBcdHRtaER5bmFtaWNMb2NhbGVQcm92aWRlci5sb2NhbGVMb2NhdGlvblBhdHRlcm4oJy4vanMvbGliL2kxOG4vYW5ndWxhci1sb2NhbGVfe3tsb2NhbGV9fS5qcycpO1xuLy8gfV0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuY29yZScsIFtcblx0J25nQW5pbWF0ZScsXG5cdCduZ01hdGVyaWFsJyxcblx0J2FuZ3VsYXJNb21lbnQnLFxuXHQnYW5ndWxhci1zdG9yYWdlJyxcblx0J21kLmRhdGEudGFibGUnLFxuXHQnY2hhcnQuanMnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNycicsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnLCBbXG5cdCdhcHAuY29yZSdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuZmNyJywgW1xuXHQnYXBwLmNvcmUnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmxheW91dCcsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5xb3MnLCBbXG5cdCdhcHAuY29yZSdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAucm91dGVzJywgW1xuXHQnbmdSb3V0ZSdcbl0pXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0b3RoZXJ3aXNlKHtcblx0XHRcdHJlZGlyZWN0VG86ICcvZGFzaGJvYXJkJ1xuXHRcdH0pO1xufV0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmNvbXBhbmllcycpXG5cdFx0LmNvbnRyb2xsZXIoJ0NvbXBTZXR0aW5nc0NvbnRyb2xsZXInLCBDb21wU2V0dGluZ3NDb250cm9sbGVyKTtcblxuXHRDb21wU2V0dGluZ3NDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckbWREaWFsb2cnLCAnc2wnLCAnZGVidWdTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gQ29tcFNldHRpbmdzQ29udHJvbGxlcigkc2NvcGUsICRtZERpYWxvZywgc2wsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0uc2wgPSBzbDtcblx0XHR2bS5zbHMgPSBbNSwgMTAsIDE1LCAyMCwgMjUsIDMwLCAzNSwgNDBdO1xuXHRcdHZtLnNhdmUgPSBzYXZlO1xuXHRcdHZtLmNsb3NlID0gY2xvc2VTZXR0aW5ncztcblxuXHRcdGZ1bmN0aW9uIHNhdmUoKSB7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNsOiB2bS5zbFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY2xvc2VTZXR0aW5ncygpIHtcblx0XHRcdCRtZERpYWxvZy5jYW5jZWwoKTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmNvbXBhbmllcycpXG5cdFx0LmNvbnRyb2xsZXIoJ0NvbXBhbmllc0NvbnRyb2xsZXInLCBDb21wYW5pZXNDb250cm9sbGVyKTtcblxuXHRDb21wYW5pZXNDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckbWREaWFsb2cnLCAnJG1kTWVkaWEnLCAnYXBpU2VydmljZScsICdzcGlubmVyU2VydmljZScsICdTZXR0aW5nc1NlcnZpY2UnLCAnY2hhcnRTZXJ2aWNlJywgJ3V0aWxzU2VydmljZScsICdkZWJ1Z1NlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gQ29tcGFuaWVzQ29udHJvbGxlcigkc2NvcGUsICRtZERpYWxvZywgJG1kTWVkaWEsIGFwaSwgc3Bpbm5lclNlcnZpY2UsIFNldHRpbmdzU2VydmljZSwgY2hhcnRTZXJ2aWNlLCB1dGlscywgZGVidWcsIGVycm9yU2VydmljZSkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblx0XHR2YXIgZGVmYXVsdHMgPSB7XG5cdFx0XHRwZXJpb2Q6ICcxIG1vbnRoJ1xuXHRcdH07XG5cblx0XHR2bS5zbCA9IDIwO1xuXHRcdHZtLnNldHRpbmdzID0ge307XG5cdFx0dm0uc3RhdCA9IFtdO1xuXHRcdHZtLmNoYXJ0RGF0YSA9IHt9O1xuXHRcdHZtLmNoYXJ0T3B0aW9ucyA9IHtcblx0XHRcdC8vIHJlc3BvbnNpdmU6IGZhbHNlLFxuXHRcdFx0Ly8gc2NhbGVzOiB7XG5cdFx0XHQvLyBcdHlBeGVzOiBbe1xuXHRcdFx0Ly8gXHRcdGRpc3BsYXk6IGZhbHNlXG5cdFx0XHQvLyBcdH1dLFxuXHRcdFx0Ly8gXHR4QXhlczogW3tcblx0XHRcdC8vIFx0XHRkaXNwbGF5OiBmYWxzZVxuXHRcdFx0Ly8gXHR9XVxuXHRcdFx0Ly8gfSxcblx0XHRcdC8vIGxlZ2VuZDoge1xuXHRcdFx0Ly8gXHRkaXNwbGF5OiBmYWxzZVxuXHRcdFx0Ly8gfVxuXHRcdH07XG5cdFx0dm0uY2hhcnRMYWJlbCA9ICduY28nO1xuXHRcdHZtLmNoYXJ0TWV0cmljcyA9IFt7IGluZGV4OiAnbmNvJywgbmFtZTogJ051bWJlciBvZiBjYWxscyBvZmZlcmVkJyB9LCB7IGluZGV4OiAnbmNhJywgbmFtZTogJ051bWJlciBvZiBjYWxscyBhbnN3ZXJlZCcgfSwgeyBpbmRleDogJ2FodCcsIG5hbWU6ICdBdmVyYWdlIGhhbmRsZSB0aW1lJyB9LCB7IGluZGV4OiAnYXR0JywgbmFtZTogJ0F2ZXJhZ2UgdGFsayB0aW1lJyB9XTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdHMucGVyaW9kKS5iZWdpbjtcblx0XHR2bS5lbmQgPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRzLnBlcmlvZCkuZW5kO1xuXHRcdHZtLnRhYmxlU29ydCA9ICctbmNvJztcblx0XHR2bS5nZXRDb21wYW5pZXNTdGF0ID0gZ2V0Q29tcGFuaWVzU3RhdDtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0ub25Db21wU2VsZWN0ID0gb25Db21wU2VsZWN0O1xuXHRcdHZtLnVzZXJGdWxsU2NyZWVuID0gJG1kTWVkaWEoJ3hzJyk7XG5cdFx0XG5cblx0XHRpbml0KCk7XG5cdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKSB7XG5cdFx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdFx0cmV0dXJuIGdldENvbXBhbmllc1N0YXQoKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRyZXR1cm4gdm0uY2hhcnRMYWJlbDtcblx0XHRcdFx0fSwgZnVuY3Rpb24obmV3VmFsdWUsIHByZXZWYWx1ZSkge1xuXHRcdFx0XHRcdHZtLmNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uc3RhdCwgdm0uY2hhcnRMYWJlbCwgdm0uc2V0dGluZ3MudGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uLCB2bS5jaGFydExhYmVsKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvcGVuU2V0dGluZ3MoJGV2ZW50KSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnY29tcGFuaWVzL2NvbXAtc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdDb21wU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnY29tcFNldHRzVm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0c2w6IHZtLnNsXG5cdFx0XHRcdH1cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLnNsID0gcmVzdWx0LnNsO1xuXHRcdFx0XHRnZXRDb21wYW5pZXNTdGF0KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDb21wYW5pZXNTdGF0KCl7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXHRcdFx0dmFyIHRhYmxlc0xpc3QgPSBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jb21wYW5pZXMubmFtZV07XG5cdFx0XHR2YXIgbWV0cmljcyA9IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJywgJ2NhcicsICdhc2EnLCAnc2wnK3ZtLnNsXTtcblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY29tcGFuaWVzLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiB0YWJsZXNMaXN0LFxuXHRcdFx0XHR0YWJyZWw6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueV0uam9pbignLicpKyc9JytbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnksIHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENvbXBhbmllc1N0YXQ6ICcsIHJlc3BvbnNlLCByZXNwb25zZS5kYXRhKTtcblxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjb21wYW5pZXMtbG9hZGVyJylcblxuXHRcdFx0XHRpZihyZXNwb25zZS5kYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3cocmVzcG9uc2UuZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0dm0uc3RhdCA9IHJlc3BvbnNlLmRhdGEucmVzdWx0Lmxlbmd0aCA/IGFkZFBlcmNlbnRhZ2VWYWx1ZXMocmVzcG9uc2UuZGF0YS5yZXN1bHQsIHJlc3BvbnNlLmRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpKSA6IFtdO1xuXHRcdFx0XHR2bS5jaGFydERhdGEgPSBjaGFydFNlcnZpY2Uuc2V0Q2hhcnREYXRhKHZtLnN0YXQsIHZtLmNoYXJ0TGFiZWwsIHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdm0uY2hhcnRMYWJlbCk7XG5cdFx0XHRcdFxuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvbkNvbXBTZWxlY3QoaXRlbSkge1xuXHRcdFx0ZGVidWcubG9nKCdvbkNvbXBTZWxlY3Q6ICcsIGl0ZW0pO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjb21wYW5pZXMtbG9hZGVyJyk7XG5cdFx0XHRcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5zZXR0aW5ncy50YWJsZXM7XG5cdFx0XHR2YXIgY29sdW1uc0FsaWFzID0ge1xuXHRcdFx0XHRhZ2VudDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpLFxuXHRcdFx0XHRwaG9uZTogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jdXN0b21lcl9waG9uZV0uam9pbignLicpLFxuXHRcdFx0XHRkYXRlOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxkYXRlXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbW1lbnQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tbWVudHNdLmpvaW4oJy4nKVxuXHRcdFx0fSxcblx0XHRcdGNvbHVtbnMsIGNvbHVtbnNLZXlzO1xuXG5cdFx0XHR2YXIgdGFibGVzTGlzdCA9IFt0YWJsZXMucHJvY2Vzc2VkLm5hbWUsIHRhYmxlcy5jYWxscy5uYW1lXTtcblx0XHRcdGlmKHRhYmxlcy5jb21wYW5pZXMpIHRhYmxlc0xpc3QucHVzaCh0YWJsZXMuY29tcGFuaWVzLm5hbWUpO1xuXG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55KSBjb2x1bW5zQWxpYXMuZGVzY3JpcHRpb24gPSBbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLmpvaW4oJy4nKTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmN1c3RvbWVyX25hbWUpIGNvbHVtbnNBbGlhcy5jbmFtZSA9IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY3VzdG9tZXJfbmFtZV0uam9pbignLicpO1xuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCkgY29sdW1uc0FsaWFzLmNhbGxyZXN1bHQgPSBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKTtcblxuXHRcdFx0Y29sdW1ucyA9IE9iamVjdC5rZXlzKGNvbHVtbnNBbGlhcykubWFwKGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gY29sdW1uc0FsaWFzW2tleV07IH0pO1xuXHRcdFx0Y29sdW1uc0tleXMgPSBPYmplY3Qua2V5cyhjb2x1bW5zQWxpYXMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIGtleTsgfSk7XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0UXVlcnlSZXN1bHRTZXQoe1xuXHRcdFx0XHR0YWJsZXM6IHRhYmxlc0xpc3QsXG5cdFx0XHRcdHRhYnJlbDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55XS5qb2luKCcuJykrJz0nK2l0ZW1bdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueV0rXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkICcrXHRcdFx0XHRcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY29tcGFuaWVzLm5hbWUsIHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5wcm9jaWQnLFxuXHRcdFx0XHRjb2x1bW5zOiBPYmplY3Qua2V5cyhjb2x1bW5zKS5tYXAoZnVuY3Rpb24oa2V5KSB7IHJldHVybiBjb2x1bW5zW2tleV07IH0pLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2Upe1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjb21wYW5pZXMtbG9hZGVyJyk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgcHJvY2Vzc2VzID0gdXRpbHMucXVlcnlUb09iamVjdChyZXNwb25zZS5kYXRhLnJlc3VsdCwgY29sdW1uc0tleXMpO1xuXG5cdFx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9leHBvcnQtcHJvY2Vzc2VzLmh0bWwnLFxuXHRcdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdFx0dGFibGVzOiB2bS5zZXR0aW5ncy50YWJsZXMsXG5cdFx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4sXG5cdFx0XHRcdFx0XHRlbmQ6IHZtLmVuZCxcblx0XHRcdFx0XHRcdGRhdGE6IHByb2Nlc3Nlc1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Y29udHJvbGxlcjogJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXInLFxuXHRcdFx0XHRcdGNvbnRyb2xsZXJBczogJ3Byb2NFeHBWbScsXG5cdFx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0ZGVidWcubG9nKCdvbkNvbXBTZWxlY3QgcmVzdWx0OiAnLCByZXNwb25zZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhZGRQZXJjZW50YWdlVmFsdWVzKGRhdGEsIHRvdGFscyl7XG5cdFx0XHR2YXIgZGF0YVZhbHVlO1xuXHRcdFx0XHQvLyB0b3RhbHMgPSBkYXRhLnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXG5cdFx0XHRyZXR1cm4gdXRpbHMuc2V0UGVyY2VudGFnZVZhbHVlcyhkYXRhLCB0b3RhbHMpLm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0YW5ndWxhci5mb3JFYWNoKGl0ZW0sIGZ1bmN0aW9uKHZhbHVlLCBrZXkpe1xuXHRcdFx0XHRcdGRhdGFWYWx1ZSA9IHBhcnNlRmxvYXQodmFsdWUpO1xuXG5cdFx0XHRcdFx0aWYoIWlzTmFOKGRhdGFWYWx1ZSkpIGl0ZW1ba2V5XSA9IGRhdGFWYWx1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNvbXBhbmllcycpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2NvbXBhbmllcycsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnY29tcGFuaWVzL2NvbXBhbmllcy5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdDb21wYW5pZXNDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2NvbXBWbSdcblx0XHR9KTtcbn1dKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5jcnInKVxuXHRcdC5jb250cm9sbGVyKCdDcnJTZXR0aW5nc0NvbnRyb2xsZXInLCBDcnJTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdENyclNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJG1kRGlhbG9nJywgJ3Rhc2tzJywgJ3NlbGVjdGVkVGFza3MnLCAnZGVidWdTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gQ3JyU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCB0YXNrcywgc2VsZWN0ZWRUYXNrcywgZGVidWcpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS50YXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IFtdLmNvbmNhdChzZWxlY3RlZFRhc2tzKTtcblx0XHR2bS5zZWxlY3RBbGxUYXNrcyA9IHNlbGVjdEFsbFRhc2tzO1xuXHRcdHZtLmFsbFRhc2tzU2VsZWN0ZWQgPSAodGFza3MubGVuZ3RoID09PSBzZWxlY3RlZFRhc2tzLmxlbmd0aCk7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5pbmRleCA9IGluZGV4O1xuXHRcdHZtLmV4aXN0cyA9IGV4aXN0cztcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdHJldHVybiB2bS5zZWxlY3RlZFRhc2tzLmxlbmd0aDtcblx0XHR9LCBmdW5jdGlvbih2YWwpe1xuXHRcdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLnNlbGVjdGVkVGFza3MubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHRkZWJ1Zy5sb2coJ3Rhc2tzbSBzZWxlY3RlZFRhc2tzOiAnLCB2bS50YXNrcywgdm0uc2VsZWN0ZWRUYXNrcyk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRzZWxlY3RlZFRhc2tzOiB2bS5zZWxlY3RlZFRhc2tzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0uc2VsZWN0ZWRUYXNrcyA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLnNlbGVjdGVkVGFza3MgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0b2dnbGUoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IGluZGV4KGl0ZW0sIGxpc3QpO1xuXHRcdFx0aWYgKGlkeCAhPT0gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0gPT0gaXRlbSkgaWR4ID0gaW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBpZHg7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmNycicpXG5cdFx0LmNvbnRyb2xsZXIoJ0NyckNvbnRyb2xsZXInLCBDcnJDb250cm9sbGVyKTtcblxuXHRDcnJDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJG1kRGlhbG9nJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ3N0b3JlJywgJ1Rhc2tzU2VydmljZScsICd1dGlsc1NlcnZpY2UnLCAnZGVidWdTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2Vycm9yU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIENyckNvbnRyb2xsZXIoJHJvb3RTY29wZSwgJG1kRGlhbG9nLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgc3RvcmUsIFRhc2tzU2VydmljZSwgdXRpbHMsIGRlYnVnLCBzcGlubmVyU2VydmljZSwgZXJyb3JTZXJ2aWNlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXHRcdHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcblx0XHRcdHBlcmlvZDogJzEgbW9udGgnXG5cdFx0fTtcblx0XHR2YXIgcGVyZlN0YXQgPSBbXTtcblx0XHR2YXIgYWdlbnRTdGF0ID0gW107XG5cdFx0dmFyIGFnZW50c0ZjciA9IHt9O1xuXG5cdFx0dm0uc2V0dGluZ3MgPSB7fTtcblx0XHR2bS50YXNrcyA9IFtdO1xuXHRcdHZtLnNlbGVjdGVkVGFza3MgPSBbXTtcblx0XHR2bS5zdGF0ID0gW107XG5cdFx0dm0uYmVnaW4gPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRPcHRpb25zLnBlcmlvZCkuYmVnaW47XG5cdFx0dm0uZW5kID0gdXRpbHMucGVyaW9kVG9SYW5nZShkZWZhdWx0T3B0aW9ucy5wZXJpb2QpLmVuZDtcblx0XHR2bS5nZXRDYWxsUmVzb2x1dGlvbiA9IGdldENhbGxSZXNvbHV0aW9uO1xuXHRcdHZtLm9wZW5TZXR0aW5ncyA9IG9wZW5TZXR0aW5ncztcblx0XHR2bS50YWJsZVNvcnQgPSAnLXBlcmYnO1xuXHRcdHZtLmRhdGEgPSBzdG9yZS5nZXQoJ2RhdGEnKTtcblxuXHRcdGluaXQoKTtcblx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdtYWluLWxvYWRlcicpO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdCgpIHtcblx0XHRcdFNldHRpbmdzU2VydmljZS5nZXRTZXR0aW5ncygpXG5cdFx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdFx0dm0uc2V0dGluZ3MgPSBkYlNldHRpbmdzO1xuXHRcdFx0XHRyZXR1cm4gZ2V0VGFza0xpc3Qodm0uZGF0YSk7XG5cdFx0XHRcdC8vIHJldHVybiBUYXNrc1NlcnZpY2UuZ2V0VGFza0xpc3QoMSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24odGFza3MpIHtcblx0XHRcdFx0ZGVidWcubG9nKCd0YXNrczogJywgdGFza3MpO1xuXHRcdFx0XHR2bS50YXNrcyA9IHRhc2tzO1xuXHRcdFx0XHR2bS5zZWxlY3RlZFRhc2tzID0gdGFza3M7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZ2V0Q2FsbFJlc29sdXRpb24pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5TZXR0aW5ncygkZXZlbnQpIHtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdjcnIvY3JyLXNldHRpbmdzLmh0bWwnLFxuXHRcdFx0XHRjb250cm9sbGVyOiAnQ3JyU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnY3JyU2V0dHNWbScsXG5cdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRsb2NhbHM6IHtcblx0XHRcdFx0XHR0YXNrczogdm0udGFza3MsXG5cdFx0XHRcdFx0c2VsZWN0ZWRUYXNrczogdm0uc2VsZWN0ZWRUYXNrc1xuXHRcdFx0XHR9XG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHR2bS5zZWxlY3RlZFRhc2tzID0gcmVzdWx0LnNlbGVjdGVkVGFza3M7XG5cdFx0XHRcdGdldENhbGxSZXNvbHV0aW9uKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDYWxsUmVzb2x1dGlvbigpIHtcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5zZXR0aW5ncy50YWJsZXM7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2Nyci1sb2FkZXInKTtcblxuXHRcdFx0cmV0dXJuIGdldEFnZW50c1N0YXQodGFibGVzLCB2bS5iZWdpbi52YWx1ZU9mKCksIHZtLmVuZC52YWx1ZU9mKCkpXG5cdFx0XHQudGhlbihmdW5jdGlvbihhc3RhdCkge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldEFnZW50c1N0YXQgZGF0YTogJywgYXN0YXQuZGF0YS5yZXN1bHQpO1xuXHRcdFx0XHRhZ2VudFN0YXQgPSBhc3RhdC5kYXRhLnJlc3VsdFxuXHRcdFx0XHRyZXR1cm4gZ2V0UGVyZlN0YXQodGFibGVzLCB2bS5iZWdpbi52YWx1ZU9mKCksIHZtLmVuZC52YWx1ZU9mKCkpO1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHBzdGF0KSB7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0UGVyZlN0YXQgZGF0YTogJywgcHN0YXQuZGF0YS5yZXN1bHQpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ3NlbGVjdGVkVGFza3M6ICcsIHZtLnNlbGVjdGVkVGFza3MpO1xuXHRcdFx0XHRwZXJmU3RhdCA9IHBzdGF0LmRhdGEucmVzdWx0O1xuXHRcdFx0XHR2bS5zdGF0ID0gYW5ndWxhci5tZXJnZShbXSwgYWdlbnRTdGF0LCBwZXJmU3RhdCk7XG5cdFx0XHRcdHZtLnN0YXQubWFwKGFkZFBlcmZWYWx1ZSk7XG5cblx0XHRcdFx0cmV0dXJuIGFwaS5nZXRGQ1JTdGF0aXN0aWNzKHtcblx0XHRcdFx0XHR0YXNrOiB2bS5zZWxlY3RlZFRhc2tzLFxuXHRcdFx0XHRcdHRhYmxlOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdFx0aW50ZXJ2YWw6IDM2MDAqMjQqMTAwMCxcblx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLCBcblx0XHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZmNyKSB7XG5cdFx0XHRcdGFnZW50c0ZjciA9IGFycmF5VG9PYmplY3RBbmRTdW0oZmNyLmRhdGEucmVzdWx0LCAnYWdlbnQnKTtcblx0XHRcdFx0ZGVidWcubG9nKCdmY3I6ICcsIGFnZW50c0Zjcik7XG5cdFx0XHRcdHZtLnN0YXQubWFwKGFkZEZjclZhbHVlKTtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY3JyLWxvYWRlcicpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QWdlbnRzU3RhdCh0YWJsZXMsIGJlZ2luLCBlbmQpe1xuXHRcdFx0dmFyIGRhdGEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudCgqKScsJ3N1bShjb25uZWN0VGltZSknLCdhdmcoY29ubmVjdFRpbWUpJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJyt2bS5zZWxlY3RlZFRhc2tzLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkJyxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXSxcblx0XHRcdFx0YmVnaW46IGJlZ2luLFxuXHRcdFx0XHRlbmQ6IGVuZCxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0UGVyZlN0YXQodGFibGVzLCBiZWdpbiwgZW5kKXtcblx0XHRcdHZhciBkYXRhLFxuXHRcdFx0bWV0cmljcyA9IFsnY291bnQoY2FsbHJlc3VsdCknXTtcblxuXHRcdFx0cmV0dXJuIGFwaS5nZXRDdXN0b21MaXN0U3RhdGlzdGljcyh7XG5cdFx0XHRcdHRhYmxlczogW3RhYmxlcy5jYWxscy5uYW1lXSxcblx0XHRcdFx0dGFicmVsOiAndGFza2lkIGluIChcXCcnK3ZtLnNlbGVjdGVkVGFza3Muam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQnK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKSsnPTEnLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLFxuXHRcdFx0XHRiZWdpbjogYmVnaW4sXG5cdFx0XHRcdGVuZDogZW5kLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhZGRQZXJmVmFsdWUoaXRlbSkge1xuXHRcdFx0aXRlbS5wZXJmID0gaXRlbVsnY291bnQoY2FsbHJlc3VsdCknXSAvIGl0ZW1bJ2NvdW50KCopJ10gKiAxMDA7XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhZGRGY3JWYWx1ZShpdGVtKSB7XG5cdFx0XHR2YXIgY3VyckZjciA9IGFnZW50c0ZjcltpdGVtLm9wZXJhdG9yXTtcblx0XHRcdGl0ZW0uZmNyID0gY3VyckZjciAhPT0gdW5kZWZpbmVkID8gKGN1cnJGY3IuZmNyIC8gY3VyckZjci50b3RhbCAqIDEwMCkgOiBudWxsO1xuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0xpc3QoZGF0YSkge1xuXHRcdFx0dmFyIHRhc2tzID0gW107XG5cdFx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0dGFza3MgPSB0YXNrcy5jb25jYXQoZGF0YVtpdGVtXS50YXNrcyk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0YXNrcztcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhcnJheVRvT2JqZWN0KGFycmF5LCBwcm9wTmFtZSkge1xuXHRcdFx0cmV0dXJuIGFycmF5LnJlZHVjZShmdW5jdGlvbihwcmV2LCBuZXh0KSB7XG5cdFx0XHRcdGlmKG5leHQuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG5cdFx0XHRcdFx0cHJldltuZXh0W3Byb3BOYW1lXV0gPSBuZXh0O1xuXHRcdFx0XHRcdHJldHVybiBwcmV2O1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB7fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXJyYXlUb09iamVjdEFuZFN1bShhcnJheSwgcHJvcE5hbWUpIHtcblx0XHRcdHJldHVybiBhcnJheS5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgbmV4dCkge1xuXHRcdFx0XHRpZihuZXh0Lmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuXHRcdFx0XHRcdHByZXZbbmV4dFtwcm9wTmFtZV1dID0gcHJldltuZXh0W3Byb3BOYW1lXV0gPyBzdW1PYmplY3RzKG5leHQsIHByZXZbbmV4dFtwcm9wTmFtZV1dKSA6IG5leHQ7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0cmV0dXJuIHByZXY7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHt9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdW1PYmplY3RzKCkge1xuXHRcdFx0dmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cdFx0XHR2YXIgc3VtID0ge307XG5cblx0XHRcdHJldHVybiBhcmdzLnJlZHVjZShmdW5jdGlvbih0b3RhbCwgbmV4dCkge1xuXG5cdFx0XHRcdE9iamVjdC5rZXlzKG5leHQpXG5cdFx0XHRcdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdGlmKHR5cGVvZiBuZXh0W2tleV0gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHR0b3RhbFtrZXldID0gdG90YWxba2V5XSA/IHRvdGFsW2tleV0gKyBuZXh0W2tleV0gOiBuZXh0W2tleV07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvdGFsW2tleV0gPSBuZXh0W2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gdG90YWw7XG5cblx0XHRcdH0sIHN1bSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNycicpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2NycicsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnY3JyL2Nyci5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdDcnJDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2NyclZtJ1xuXHRcdH0pO1xufV0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ0Rhc2hFeHBvcnRDb250cm9sbGVyJywgRGFzaEV4cG9ydENvbnRyb2xsZXIpO1xuXG5cdERhc2hFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRtZERpYWxvZycsICdraW5kcycsICd0YWJsZXMnLCAnZGF0YScsICdiZWdpbicsICdlbmQnLCAnc3RhdCcsICdwcmV2c3RhdCcsICdjYXRzdGF0J107XG5cblx0ZnVuY3Rpb24gRGFzaEV4cG9ydENvbnRyb2xsZXIoJG1kRGlhbG9nLCBraW5kcywgdGFibGVzLCBkYXRhLCBiZWdpbiwgZW5kLCBzdGF0LCBwcmV2c3RhdCwgY2F0c3RhdCkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLmtpbmRzID0ga2luZHM7XG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLnN0YXQgPSBzdGF0O1xuXHRcdHZtLnByZXZzdGF0ID0gcHJldnN0YXQ7XG5cdFx0dm0uY2F0c3RhdCA9IGNhdHN0YXQ7XG5cdFx0dm0uY2xvc2UgPSBmdW5jdGlvbigpe1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoKTtcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5jb250cm9sbGVyKCdEYXNoU2V0dGluZ3NDb250cm9sbGVyJywgRGFzaFNldHRpbmdzQ29udHJvbGxlcik7XG5cblx0RGFzaFNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckbWREaWFsb2cnLCAnb3B0aW9ucyddO1xuXG5cdGZ1bmN0aW9uIERhc2hTZXR0aW5nc0NvbnRyb2xsZXIoJG1kRGlhbG9nLCBvcHRpb25zKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0ub3B0aW9ucyA9IGFuZ3VsYXIuY29weShvcHRpb25zLCB7fSk7XG5cdFx0dm0ucGVyaW9kcyA9IFsnMSBob3VyJywgJzEgZGF5JywgJzEgd2VlaycsICcxIG1vbnRoJywgJzYgbW9udGhzJywgJzEgeWVhciddO1xuXHRcdHZtLmludGVydmFscyA9IFsnMSBtaW51dGVzJywgJzUgbWludXRlcycsICcxMCBtaW51dGVzJywgJzIwIG1pbnV0ZXMnLCAnMzAgbWludXRlcycsICcxIGhvdXInXTtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmluZGV4ID0gaW5kZXg7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRvcHRpb25zOiB2bS5vcHRpb25zXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gdm0uaW5kZXgoaXRlbSwgbGlzdCk7XG5cdFx0XHRpZiAoaWR4ID4gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0ua2luZCA9PSBpdGVtLmtpbmQpIGlkeCA9IGluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaWR4O1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignRGFzaENvbnRyb2xsZXInLCBEYXNoQ29udHJvbGxlcik7XG5cblx0RGFzaENvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckc2NvcGUnLCAnJHRpbWVvdXQnLCAnJHEnLCAnJG1kTWVkaWEnLCAnJG1kQm90dG9tU2hlZXQnLCAnJG1kRGlhbG9nJywgJyRtZFRvYXN0JywgJ3N0b3JlJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2NoYXJ0U2VydmljZScsICdkZWJ1Z1NlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJywgJ3V0aWxzU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIERhc2hDb250cm9sbGVyKCRyb290U2NvcGUsICRzY29wZSwgJHRpbWVvdXQsICRxLCAkbWRNZWRpYSwgJG1kQm90dG9tU2hlZXQsICRtZERpYWxvZywgJG1kVG9hc3QsIHN0b3JlLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgc3Bpbm5lclNlcnZpY2UsIGNoYXJ0U2VydmljZSwgZGVidWcsIGVycm9yU2VydmljZSwgdXRpbHMpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHREYXRhID0ge1xuXHRcdFx0SW5jb21pbmdfQWdlbnQ6IHtcblx0XHRcdFx0a2luZDogMSxcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDIwLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYScsICdjYXInLCAnYXNhJ11cblx0XHRcdH0sXG5cdFx0XHRNZXNzYWdpbmdfQ2hhdDoge1xuXHRcdFx0XHRraW5kOiA3LFxuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRzbDogNSxcblx0XHRcdFx0bWV0cmljczogWydhaHQnLCAnYXR0JywgJ25jbycsICduY2EnLCAnY2FyJ11cblx0XHRcdH0sXG5cdFx0XHRBdXRvZGlhbF9BZ2VudDoge1xuXHRcdFx0XHRraW5kOiAxMjksXG5cdFx0XHRcdHRhc2tzOiBbXSxcblx0XHRcdFx0bGlzdDogW10sXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJ11cblx0XHRcdH0sXG5cdFx0XHRDYWxsYmFja19BZ2VudDoge1xuXHRcdFx0XHRraW5kOiAyNTcsXG5cdFx0XHRcdHRhc2tzOiBbXSxcblx0XHRcdFx0bGlzdDogW10sXG5cdFx0XHRcdHNsOiAyMCxcblx0XHRcdFx0bWV0cmljczogWydhaHQnLCAnYXR0JywgJ25jbycsICduY2EnLCAnY2FyJywgJ2FzYSddXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdHM6IHtcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDIwLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYScsICdjYXInXVxuXHRcdFx0fVxuXHRcdFx0XHRcblx0XHR9LFxuXHRcdGRlZmF1bHRPcHRpb25zID0ge1xuXHRcdFx0YXV0b3VwZGF0ZTogZmFsc2UsXG5cdFx0XHR1cGRhdGVFdmVyeTogJzEgbWludXRlcycsXG5cdFx0XHRraW5kczogW3tuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfV0sXG5cdFx0XHRraW5kc0xpc3Q6IFt7bmFtZTogJ0luY29taW5nX0FnZW50Jywga2luZDogMX0sIHtuYW1lOiAnTWVzc2FnaW5nX0NoYXQnLCBraW5kOiA3fSwge25hbWU6ICdBdXRvZGlhbF9BZ2VudCcsIGtpbmQ6IDEyOX0sIHtuYW1lOiAnQ2FsbGJhY2tfQWdlbnQnLCBraW5kOiAyNTd9XSxcblx0XHRcdC8vIGtpbmRzOiBbMSwgNywgMTI5XSxcblx0XHRcdHNsOiBbNSwgMTAsIDE1LCAyMCwgMjUsIDMwLCAzNSwgNDBdLFxuXHRcdFx0ZGI6IHt9LFxuXHRcdFx0dGFibGVzOiBbXSxcblx0XHRcdHBlcmlvZDogJzEgZGF5Jyxcblx0XHRcdGNhdENvbG91cnM6IFtdLFxuXHRcdFx0Y2F0b3JkZXI6ICdjYXRkZXNjJyAvLyBjaGFuZ2VkIGR1cmluZyB0aGUgZGFzaGJvYXJkIGluaXRpYXRpb24gdG8gdGhlIHZhbHVlIGZyb20gdGhlIGNvbmZpZyBmaWxlXG5cdFx0fSxcblx0XHR1cGRhdGVUaW1lb3V0ID0gbnVsbDtcblxuXHRcdHZtLm9wdGlvbnMgPSBnZXREZWZhdWx0T3B0aW9ucygpO1xuXHRcdHZtLmRhdGEgPSBnZXREZWZhdWx0RGF0YSgpO1xuXHRcdHZtLmJlZ2luID0gdXRpbHMucGVyaW9kVG9SYW5nZSh2bS5vcHRpb25zLnBlcmlvZCkuYmVnaW47XG5cdFx0dm0uZW5kID0gdXRpbHMucGVyaW9kVG9SYW5nZSh2bS5vcHRpb25zLnBlcmlvZCkuZW5kO1xuXHRcdHZtLnN0YXQgPSB7fTtcblx0XHR2bS5wcmV2c3RhdCA9IHt9O1xuXHRcdHZtLmNhdHN0YXQgPSBbXTtcblx0XHR2bS5nbG9iYWxDciA9IHt9O1xuXHRcdHZtLmdsb2JhbEZjciA9IHt9O1xuXHRcdHZtLnByZXZHbG9iYWxGY3IgPSB7fTtcblx0XHQvLyB2bS5jYXRUb3RhbHMgPSB7fTtcblx0XHQvLyB2bS5zdWJjYXRUb3RhbHMgPSB7fTtcblx0XHR2bS5zZWxlY3RlZENhdCA9IG51bGw7XG5cdFx0dm0uc3ViQ2F0c1N0YXQgPSBbXTtcblx0XHR2bS5jYXRjaGFydERhdGEgPSB7fTtcblx0XHR2bS5jYXRjaGFydExhYmVsID0gJ25jYSc7XG5cdFx0dm0uY2hhcnRPcHRpb25zID0ge1xuXHRcdFx0bGF5b3V0OiB7XG5cdFx0XHRcdHBhZGRpbmc6IHtcblx0XHRcdFx0XHRsZWZ0OiA0MCxcblx0XHRcdFx0XHRyaWdodDogNDBcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0dm0uY2F0TWV0cmljcyA9IFt7IGluZGV4OiAnbmNhJywgbmFtZTogJ051bWJlciBvZiBjYWxscyBhbnN3ZXJlZCcgfSwgeyBpbmRleDogJ2FodCcsIG5hbWU6ICdBdmVyYWdlIGhhbmRsZSB0aW1lJyB9LCB7IGluZGV4OiAnYXR0JywgbmFtZTogJ0F2ZXJhZ2UgdGFsayB0aW1lJyB9XTtcblx0XHR2bS50b3RhbEJ5Q2F0ZWdvcnkgPSB7fTtcblx0XHR2bS51c2VyRnVsbFNjcmVlbiA9ICRtZE1lZGlhKCd4cycpO1xuXHRcdHZtLmFiUmF0ZSA9IHV0aWxzLmdldEFiYW5kb25tZW50UmF0ZTtcblx0XHQvLyB2bS5nZXRGcmllbmRseUtpbmQgPSBnZXRGcmllbmRseUtpbmQ7XG5cdFx0dm0ub3BlbkRhc2hTZXR0aW5ncyA9IG9wZW5EYXNoU2V0dGluZ3M7XG5cdFx0dm0ub25DYXRTZWxlY3QgPSBvbkNhdFNlbGVjdDtcblx0XHR2bS5vblN1YkNhdFNlbGVjdCA9IG9uU3ViQ2F0U2VsZWN0O1xuXHRcdHZtLmdldFN0YXQgPSBnZXRTdGF0O1xuXHRcdHZtLm9wZW5TZXR0aW5ncyA9IG9wZW5TZXR0aW5ncztcblx0XHR2bS5leHBvcnREYXNoID0gZXhwb3J0RGFzaDtcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdm0ub3B0aW9ucztcblx0XHR9LCBmdW5jdGlvbihuZXdWYWx1ZSwgcHJldlZhbHVlKSB7XG5cdFx0XHRkZWJ1Zy5sb2coJ09wdGlvbnMgY2hhbmdlZCEhIScsIG5ld1ZhbHVlKTtcblx0XHRcdHN0b3JlLnNldCgnb3B0aW9ucycsIG5ld1ZhbHVlKTtcblx0XHR9KTtcblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZtLmNhdGNoYXJ0TGFiZWw7XG5cdFx0fSwgZnVuY3Rpb24obmV3VmFsdWUsIHByZXZWYWx1ZSkge1xuXHRcdFx0aWYodm0uc2VsZWN0ZWRDYXQpXG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uc3ViQ2F0c1N0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHZtLm9wdGlvbnMuZGIudGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdm0uY2F0Y2hhcnRMYWJlbCk7XG5cdFx0XHRlbHNlXG5cdFx0XHRcdGlmKHZtLm9wdGlvbnMuZGIudGFibGVzKSB2bS5jYXRjaGFydERhdGEgPSBjaGFydFNlcnZpY2Uuc2V0Q2hhcnREYXRhKHZtLmNhdHN0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHZtLm9wdGlvbnMuZGIudGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdm0uY2F0Y2hhcnRMYWJlbCk7XG5cdFx0fSk7XG5cdFx0JHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcblx0XHRcdCR0aW1lb3V0LmNhbmNlbCh1cGRhdGVUaW1lb3V0KTtcblx0XHRcdHVwZGF0ZVRpbWVvdXQgPSBudWxsO1xuXHRcdH0pO1xuXG5cdFx0Ly8gR2V0IERCIHNldHRpbmdzIGFuZCBpbml0IHRoZSBEYXNoYm9hcmRcblx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdC50aGVuKGZ1bmN0aW9uKGRiU2V0dGluZ3Mpe1xuXHRcdFx0ZGVidWcubG9nKCdEQiBzZXR0aW5ncycsIGRiU2V0dGluZ3MpO1xuXHRcdFx0dmFyIHRhYmxlcyA9IGRiU2V0dGluZ3MudGFibGVzLFxuXHRcdFx0XHRvcHRpb25zID0ge1xuXHRcdFx0XHRcdGRiOiBkYlNldHRpbmdzLFxuXHRcdFx0XHRcdHRhYmxlc0xpc3Q6IFtdLFxuXHRcdFx0XHRcdGNhbGxzdGFibGU6IHRhYmxlcy5jYWxscyA/IHRhYmxlcy5jYWxscyA6IG51bGwsXG5cdFx0XHRcdFx0Y2F0dGFibGU6IHRhYmxlcy5jYXRlZ29yaWVzID8gdGFibGVzLmNhdGVnb3JpZXMgOiBudWxsLFxuXHRcdFx0XHRcdHN1YmNhdHRhYmxlOiB0YWJsZXMuc3ViY2F0ZWdvcmllcyA/IHRhYmxlcy5zdWJjYXRlZ29yaWVzIDogbnVsbCxcblx0XHRcdFx0XHRjYXRvcmRlcjogdGFibGVzLmNhdGVnb3JpZXMgPyB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uIDogbnVsbFxuXHRcdFx0XHR9O1xuXG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh2bS5vcHRpb25zLCBvcHRpb25zKTtcblx0XHRcdGFuZ3VsYXIuZm9yRWFjaCh0YWJsZXMsIGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdFx0XHRpZihpdGVtLm5hbWUpIHZtLm9wdGlvbnMudGFibGVzTGlzdC5wdXNoKGl0ZW0ubmFtZSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0aW5pdCgpO1xuXHRcdFx0YXV0b1VwZGF0ZSgpO1xuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdCgpe1xuXHRcdFx0aWYoIXZtLm9wdGlvbnMua2luZHMubGVuZ3RoKSByZXR1cm4gc3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdFx0dm0ub3B0aW9ucy5raW5kcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4LCBhcnJheSkge1xuXHRcdFx0XHRhcGkuZ2V0VGFza3MoeyBraW5kOiBpdGVtLmtpbmQgfSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNldFRhc2tzKHJlc3VsdCwgaXRlbSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKHRhc2tzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdldFN0YXREYXRhKHZtLmRhdGFbaXRlbS5uYW1lXS5saXN0IHx8IHRhc2tzLCBpdGVtKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUgJiYgdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhbGxSZXNvbHV0aW9uU3RhdChpdGVtKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICRxLmRlZmVyKCkucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlICYmIHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luKSB7XG5cdFx0XHRcdFx0XHRkZWJ1Zy5sb2coJ3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luOiAnLCB2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5sb2dpbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0TG9naW5zUmF0aW8oaXRlbSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAkcS5kZWZlcigpLnJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC8vIC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBcdGlmKHZtLm9wdGlvbnMuY2F0dGFibGUpIHtcblx0XHRcdFx0Ly8gXHRcdHJldHVybiBnZXRDYXRlZ29yaWVzU3RhdCgpO1xuXHRcdFx0XHQvLyBcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFx0XHRyZXR1cm4gJHEuZGVmZXIoKS5yZXNvbHZlKCk7XG5cdFx0XHRcdC8vIFx0fVxuXHRcdFx0XHQvLyB9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRnZXRHbG9iYWxGcmMoaXRlbSwgJ2luaXQnKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZihpbmRleCA9PT0gYXJyYXkubGVuZ3RoLTEpIHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ21haW4tbG9hZGVyJyk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYodm0ub3B0aW9ucy5jYXR0YWJsZSkgZ2V0Q2F0ZWdvcmllc1N0YXQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhdXRvVXBkYXRlKCl7XG5cdFx0XHR2YXIgZHVyID0gdm0ub3B0aW9ucy51cGRhdGVFdmVyeS5zcGxpdCgnICcpO1xuXHRcdFx0dXBkYXRlVGltZW91dCA9ICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZih2bS5vcHRpb25zLmF1dG91cGRhdGUpIHZtLmdldFN0YXQoKTtcblx0XHRcdFx0YXV0b1VwZGF0ZSgpO1xuXHRcdFx0fSwgbW9tZW50LmR1cmF0aW9uKHBhcnNlSW50KGR1clswXSwgMTApLCBkdXJbMV0pLl9taWxsaXNlY29uZHMpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXQoa2luZHMpIHtcblx0XHRcdHZhciBraW5kc0xpc3QgPSBraW5kcyB8fCB2bS5vcHRpb25zLmtpbmRzO1xuXHRcdFx0a2luZHNMaXN0LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5zaG93KGl0ZW0ubmFtZSsnLWxvYWRlcicpO1xuXHRcdFx0XHRnZXRTdGF0RGF0YSh2bS5kYXRhW2l0ZW0ubmFtZV0ubGlzdCwgaXRlbSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUgJiYgdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhbGxSZXNvbHV0aW9uU3RhdChpdGVtKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICRxLmRlZmVyKCkucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlICYmIHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luKSB7XG5cdFx0XHRcdFx0XHRkZWJ1Zy5sb2coJ3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luOiAnLCB2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5sb2dpbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0TG9naW5zUmF0aW8oaXRlbSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAkcS5kZWZlcigpLnJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGdldEdsb2JhbEZyYyhpdGVtLCAnZ2V0U3RhdCcpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbigpeyBzcGlubmVyU2VydmljZS5oaWRlKGl0ZW0ubmFtZSsnLWxvYWRlcicpOyB9KVxuXHRcdFx0XHQuY2F0Y2goZnVuY3Rpb24oKXsgc3Bpbm5lclNlcnZpY2UuaGlkZShpdGVtLm5hbWUrJy1sb2FkZXInKTsgfSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYodm0ub3B0aW9ucy5jYXR0YWJsZSkgZ2V0Q2F0ZWdvcmllc1N0YXQoKTtcblxuXHRcdFx0JG1kVG9hc3Quc2hvdyhcblx0XHRcdFx0JG1kVG9hc3Quc2ltcGxlKClcblx0XHRcdFx0XHQudGV4dENvbnRlbnQoJ1VwZGF0aW5nIGluZGV4ZXMnKVxuXHRcdFx0XHRcdC5wb3NpdGlvbigndG9wIHJpZ2h0Jylcblx0XHRcdFx0XHQuaGlkZURlbGF5KDIwMDApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5EYXNoU2V0dGluZ3MoJGV2ZW50KSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2Rhc2gtc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnZGFzaFNldFZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdG9wdGlvbnM6IHZtLm9wdGlvbnNcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ21haW4tbG9hZGVyJyk7XG5cdFx0XHRcdHZtLm9wdGlvbnMgPSByZXN1bHQub3B0aW9ucztcblx0XHRcdFx0aW5pdCgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25DYXRTZWxlY3QoY2F0LCBpbmRleCkge1xuXHRcdFx0aWYodm0uc2VsZWN0ZWRDYXQgJiYgKCFjYXQgfHwgY2F0W3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmNhdGVnb3J5XSA9PT0gdm0uc2VsZWN0ZWRDYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldKSkge1xuXHRcdFx0XHR2bS5zZWxlY3RlZENhdCA9IG51bGw7XG5cdFx0XHRcdHZtLnN1YkNhdHNTdGF0ID0gW107XG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uY2F0c3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdm0ub3B0aW9ucy5kYi50YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uLCB2bS5jYXRjaGFydExhYmVsKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB2bS5zZWxlY3RlZENhdCA9IGNhdDtcblxuXHRcdFx0Z2V0U3ViQ2F0ZWdvcmllc1N0YXQoY2F0W3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmNhdGVnb3J5XSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHR2YXIgZGF0YSA9IHJlc3VsdC5kYXRhLCB0b3RhbHMgPSB7fTtcblx0XHRcdFx0aWYoZGF0YS5lcnJvcikgcmV0dXJuIGVycm9yU2VydmljZS5zaG93KGRhdGEuZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRcdC8vIGlmKCFkYXRhLnJlc3VsdC5sZW5ndGgpIHJldHVybjtcblxuXHRcdFx0XHQvLyB2bS5zdWJjYXRUb3RhbHMgPSBkYXRhLnJlc3VsdC5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKTtcblx0XHRcdFx0dm0uc3ViQ2F0c1N0YXQgPSBkYXRhLnJlc3VsdC5sZW5ndGggPyBzZXRDYXRzU3RhdChkYXRhLnJlc3VsdCwgZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmdldFRvdGFscykpIDogZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IGNoYXJ0U2VydmljZS5zZXRDaGFydERhdGEodm0uc3ViQ2F0c1N0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHZtLm9wdGlvbnMuZGIudGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdm0uY2F0Y2hhcnRMYWJlbCk7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvblN1YkNhdFNlbGVjdChjYXQsIHN1YmNhdCwgaW5kZXgpIHtcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdFx0dGNvbHMgPSB0YWJsZXMuY2FsbHMuY29sdW1ucyxcblx0XHRcdFx0Y29sdW1uc0FsaWFzID0ge1xuXHRcdFx0XHRcdGFnZW50OiBbdGFibGVzLmNhbGxzLm5hbWUsIHRjb2xzLm9wZXJhdG9yXS5qb2luKCcuJyksIFxuXHRcdFx0XHRcdHBob25lOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRjb2xzLmN1c3RvbWVyX3Bob25lXS5qb2luKCcuJyksIFxuXHRcdFx0XHRcdGRhdGU6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGNvbHMuY2FsbGRhdGVdLmpvaW4oJy4nKSwgXG5cdFx0XHRcdFx0Y29tbWVudDogW3RhYmxlcy5jYWxscy5uYW1lLCB0Y29scy5jb21tZW50c10uam9pbignLicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbHVtbnMsIGNvbHVtbnNLZXlzLCBkYXRhO1xuXG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55KSBjb2x1bW5zQWxpYXMuZGVzY3JpcHRpb24gPSBbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLmpvaW4oJy4nKTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmN1c3RvbWVyX25hbWUpIGNvbHVtbnNBbGlhcy5jbmFtZSA9IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY3VzdG9tZXJfbmFtZV0uam9pbignLicpO1xuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCkgY29sdW1uc0FsaWFzLmNhbGxyZXN1bHQgPSBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKTtcblxuXHRcdFx0Y29sdW1ucyA9IE9iamVjdC5rZXlzKGNvbHVtbnNBbGlhcykubWFwKGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gY29sdW1uc0FsaWFzW2tleV07IH0pO1xuXHRcdFx0Y29sdW1uc0tleXMgPSBPYmplY3Qua2V5cyhjb2x1bW5zQWxpYXMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIGtleTsgfSk7XG5cblx0XHRcdGdldENhdFByb2Nlc3Nlcyhjb2x1bW5zLCBjYXQsIHN1YmNhdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0ZGF0YSA9IHJlc3VsdC5kYXRhO1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0dm0ucHJvY2Vzc2VzID0gdXRpbHMucXVlcnlUb09iamVjdChkYXRhLnJlc3VsdCwgY29sdW1uc0tleXMpO1xuXHRcdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQvZXhwb3J0LXByb2Nlc3Nlcy5odG1sJyxcblx0XHRcdFx0XHRsb2NhbHM6IHtcblx0XHRcdFx0XHRcdHRhYmxlczogdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4sXG5cdFx0XHRcdFx0XHRlbmQ6IHZtLmVuZCxcblx0XHRcdFx0XHRcdGRhdGE6IHZtLnByb2Nlc3Nlc1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Y29udHJvbGxlcjogJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXInLFxuXHRcdFx0XHRcdGNvbnRyb2xsZXJBczogJ3Byb2NFeHBWbScsXG5cdFx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvcGVuU2V0dGluZ3MoJGV2ZW50LCBraW5kKSB7XG5cdFx0XHR2YXIgZGF0YSA9IHZtLmRhdGFba2luZC5uYW1lXTtcblx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0dGFyZ2V0RXZlbnQ6ICRldmVudCxcblx0XHRcdFx0dGVtcGxhdGVVcmw6ICdkYXNoYm9hcmQva2luZC1zZXR0aW5ncy5odG1sJyxcblx0XHRcdFx0Y29udHJvbGxlcjogJ0tpbmRTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdraW5kU2V0Vm0nLFxuXHRcdFx0XHRsb2NhbHM6IHtcblx0XHRcdFx0XHRraW5kOiBraW5kLFxuXHRcdFx0XHRcdGxpc3Q6IGRhdGEubGlzdCxcblx0XHRcdFx0XHR0YXNrczogZGF0YS50YXNrcyxcblx0XHRcdFx0XHRraW5kTWV0cmljczogZGF0YS5tZXRyaWNzLFxuXHRcdFx0XHRcdG1ldHJpY3M6IGRlZmF1bHREYXRhW2tpbmQubmFtZV0ubWV0cmljcyxcblx0XHRcdFx0XHRzbDogZGF0YS5zbCB8fCBudWxsLFxuXHRcdFx0XHRcdGRlZmF1bHRTTDogdm0ub3B0aW9ucy5zbFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ob3B0cykge1xuXHRcdFx0XHRpZihvcHRzLnNsKSBkYXRhLnNsID0gb3B0cy5zbDtcblx0XHRcdFx0ZGF0YS5tZXRyaWNzID0gb3B0cy5tZXRyaWNzO1xuXHRcdFx0XHRkYXRhLmxpc3QgPSBvcHRzLmxpc3Q7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIGRhdGFcblx0XHRcdFx0dm0uZ2V0U3RhdChba2luZF0pO1xuXG5cdFx0XHRcdC8vIFNhdmUgbmV3IGRhdGEgdG8gc3RvcmFnZVxuXHRcdFx0XHRzdG9yZS5zZXQoJ2RhdGEnLCB2bS5kYXRhKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGV4cG9ydERhc2goJGV2ZW50LCBraW5kcykge1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9leHBvcnQtZGlhbG9nLmh0bWwnLFxuXHRcdFx0XHRsb2NhbHM6IHtcblx0XHRcdFx0XHRraW5kczoga2luZHMgfHwgdm0ub3B0aW9ucy5raW5kcyxcblx0XHRcdFx0XHRkYXRhOiB2bS5kYXRhLFxuXHRcdFx0XHRcdHRhYmxlczogdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLFxuXHRcdFx0XHRcdGVuZDogdm0uZW5kLFxuXHRcdFx0XHRcdHN0YXQ6IHZtLnN0YXQsXG5cdFx0XHRcdFx0cHJldnN0YXQ6IHZtLnByZXZzdGF0LFxuXHRcdFx0XHRcdGNhdHN0YXQ6IHZtLmNhdHN0YXRcblx0XHRcdFx0fSxcblx0XHRcdFx0Y29udHJvbGxlcjogJ0Rhc2hFeHBvcnRDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnZGFzaEV4cFZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGZ1bGxzY3JlZW46IHZtLnVzZXJGdWxsU2NyZWVuXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXREZWZhdWx0RGF0YSgpe1xuXHRcdFx0dmFyIGRhdGEgPSBzdG9yZS5nZXQoJ2RhdGEnKTtcblx0XHRcdGlmKCFkYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSBkZWZhdWx0RGF0YTtcblx0XHRcdFx0c3RvcmUuc2V0KCdkYXRhJywgZGF0YSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0YTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXREZWZhdWx0T3B0aW9ucygpe1xuXHRcdFx0dmFyIG9wdGlvbnMgPSBzdG9yZS5nZXQoJ29wdGlvbnMnKTtcblx0XHRcdGlmKCFvcHRpb25zKSB7XG5cdFx0XHRcdG9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucztcblx0XHRcdH1cblx0XHRcdHJldHVybiBvcHRpb25zO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFRhc2tzU3RhdGlzdGljcyhwYXJhbXMsIG9iail7XG5cdFx0XHRyZXR1cm4gYXBpLmdldFRhc2tHcm91cFN0YXRpc3RpY3MocGFyYW1zKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHR2YXIgZGF0YSA9IHJlc3VsdC5kYXRhO1xuXG5cdFx0XHRcdGlmKGRhdGEuZXJyb3IpIHJldHVybiBlcnJvclNlcnZpY2Uuc2hvdyhkYXRhLmVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRpZihkYXRhLnJlc3VsdC5sZW5ndGgpIGFuZ3VsYXIuZXh0ZW5kKG9iaiwgZGF0YS5yZXN1bHQucmVkdWNlKHV0aWxzLmV4dGVuZEFuZFN1bSkpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0U3RhdERhdGEodGFza3MsIGtpbmQpe1xuXHRcdFx0cmV0dXJuICRxKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdFx0XHQvLyBpZighdGFza3MubGVuZ3RoKSByZXR1cm4gcmVqZWN0KCk7XG5cblx0XHRcdFx0dmFyIGN1cnJQYXJhbXMgPSB7fSxcblx0XHRcdFx0XHRwcmV2UGFyYW1zID0ge30sXG5cdFx0XHRcdFx0ZmtpbmQgPSBraW5kLm5hbWUsXG5cdFx0XHRcdFx0ZGF0YSA9IHZtLmRhdGFbZmtpbmRdLFxuXHRcdFx0XHRcdG1ldHJpY3MgPSBkYXRhLm1ldHJpY3MgfHwgdm0uZGF0YVtma2luZF0ubWV0cmljcyxcblx0XHRcdFx0XHRzbEluZGV4ID0gdXRpbHMuZ2V0U2xJbmRleChtZXRyaWNzKTtcblxuXHRcdFx0XHRjdXJyUGFyYW1zID0ge1xuXHRcdFx0XHRcdGJlZ2luOiBuZXcgRGF0ZSh2bS5iZWdpbikudmFsdWVPZigpLFxuXHRcdFx0XHRcdGVuZDogbmV3IERhdGUodm0uZW5kKS52YWx1ZU9mKCksXG5cdFx0XHRcdFx0bGlzdDogdGFza3MsXG5cdFx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGlmKGRhdGEuc2wgJiYgc2xJbmRleCA9PT0gLTEpIHtcblx0XHRcdFx0XHRjdXJyUGFyYW1zLm1ldHJpY3MucHVzaCgnc2wnK2RhdGEuc2wpO1xuXHRcdFx0XHR9IGVsc2UgaWYoZGF0YS5zbCAmJiBtZXRyaWNzW3NsSW5kZXhdICE9PSAnc2wnK2RhdGEuc2wpIHtcblx0XHRcdFx0XHRjdXJyUGFyYW1zLm1ldHJpY3Nbc2xJbmRleF0gPSAnc2wnK2RhdGEuc2w7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhbmd1bGFyLmV4dGVuZChwcmV2UGFyYW1zLCBjdXJyUGFyYW1zKTtcblx0XHRcdFx0cHJldlBhcmFtcy5iZWdpbiA9IGN1cnJQYXJhbXMuYmVnaW4gLSAoY3VyclBhcmFtcy5lbmQgLSBjdXJyUGFyYW1zLmJlZ2luKTtcblx0XHRcdFx0cHJldlBhcmFtcy5lbmQgPSBjdXJyUGFyYW1zLmJlZ2luO1xuXHRcdFx0XHRcblx0XHRcdFx0dm0uc3RhdFtma2luZF0gPSB0YXNrcy5sZW5ndGggPyAodm0uc3RhdFtma2luZF0gfHwge30pIDoge307XG5cdFx0XHRcdHZtLnByZXZzdGF0W2ZraW5kXSA9IHRhc2tzLmxlbmd0aCA/ICh2bS5wcmV2c3RhdFtma2luZF0gfHwge30pIDoge307XG5cblx0XHRcdFx0Z2V0VGFza3NTdGF0aXN0aWNzKGN1cnJQYXJhbXMsIHZtLnN0YXRbZmtpbmRdKS50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0cmV0dXJuIGdldFRhc2tzU3RhdGlzdGljcyhwcmV2UGFyYW1zLCB2bS5wcmV2c3RhdFtma2luZF0pO1xuXHRcdFx0XHR9KS50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2F2ZSBhcnJheSBvZiB0YXNrcyB0byBzY29wZSB2YXJpYWJsZXNcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0IC0gb2JqZWN0LCB3aGljaCBpcyByZXR1cm5lZCBmcm9tIGdldFRhc2tzIHF1ZXJ5IG9yIGFuIGFycmF5IG9mIHRhc2tzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0VGFza3MocmVzdWx0LCBraW5kKXtcblx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGEsXG5cdFx0XHRcdHRhc2tzID0gZGF0YSA/IGRhdGEucmVzdWx0IDogcmVzdWx0LFxuXHRcdFx0XHRma2luZCA9IGtpbmQubmFtZTtcblxuXHRcdFx0cmV0dXJuICRxKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdFx0XHRpZihkYXRhICYmIGRhdGEuZXJyKSByZXR1cm4gcmVqZWN0KGRhdGEuZXJyLm1lc3NhZ2UpO1xuXHRcdFx0XHRpZighdGFza3MpIHJldHVybiByZWplY3QoJ1Rhc2tzIGlzIHVuZGVmaW5lZCcpO1xuXG5cdFx0XHRcdGlmKCF2bS5kYXRhW2ZraW5kXSkge1xuXHRcdFx0XHRcdHZtLmRhdGFbZmtpbmRdID0gZGVmYXVsdERhdGEuZGVmYXVsdHM7XG5cdFx0XHRcdH1cblx0XHRcdFx0dm0uZGF0YVtma2luZF0udGFza3MgPSBbXS5jb25jYXQodGFza3MpO1xuXHRcdFx0XHRpZighdm0uZGF0YVtma2luZF0ubGlzdC5sZW5ndGgpIHZtLmRhdGFbZmtpbmRdLmxpc3QgPSBbXS5jb25jYXQodGFza3MpO1xuXG5cdFx0XHRcdHN0b3JlLnNldCgnZGF0YScsIHZtLmRhdGEpO1xuXG5cdFx0XHRcdHJlc29sdmUodGFza3MpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0ZWdvcmllc1N0YXQoKXtcblx0XHRcdHZhciBkYXRhLCB0YWJsZXMgPSB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdG1ldHJpY3MgPSBbJ25jYScsICdhdHQnLCAnYWh0JywgJ2FzYScsICdzbCcrdm0uZGF0YS5JbmNvbWluZ19BZ2VudC5zbF07XG5cdFx0XHRcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHQpIHtcblx0XHRcdFx0bWV0cmljcy5wdXNoKCdzdW0oY2FsbHJlc3VsdCknKTtcblx0XHRcdFx0Ly8gdm0uY2F0TWV0cmljcy5wdXNoKHsgaW5kZXg6ICdzdW0oY2FsbHJlc3VsdCknLCBuYW1lOiAnQ2FsbCByZXNvbHV0aW9uJyB9KTtcblx0XHRcdH1cblxuXHRcdFx0dm0ub3B0aW9ucy50YWJsZXNMaXN0ID0gW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lXTtcblx0XHRcdC8vIGlmKHRhYmxlcy5jb21wYW5pZXMpIHZtLm9wdGlvbnMudGFibGVzTGlzdC5wdXNoKHRhYmxlcy5jb21wYW5pZXMubmFtZSk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHQvLyB0YWJsZXM6IFsncHJvYnN0YXQnLCAncHJvYmNhdCcsICdwcm9iY29tcGFueSddLFxuXHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMudGFibGVzTGlzdCxcblx0XHRcdFx0Ly8gdGFicmVsOiAncHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iY29tcGFueT1wcm9iY29tcGFueS5jb21waWQnLFxuXHRcdFx0XHR0YWJyZWw6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdC8vICcgYW5kIHRhc2t0eXBlIGluICgnK2dldFRhc2tLaW5kcygpLmpvaW4oJywnKSsnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkJyxcblx0XHRcdFx0XHRcdC8vICh0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55ID9cblx0XHRcdFx0XHRcdC8vICcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY29tcGFuaWVzLm5hbWUsIHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5pZF0uam9pbignLicpIDpcblx0XHRcdFx0XHRcdC8vICcnKSxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0Ly8gY29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpXG5cblx0XHRcdFx0ZGF0YSA9IHJlc3VsdC5kYXRhO1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vIHZtLmNhdFRvdGFscyA9IGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXHRcdFx0XHR2bS5jYXRzdGF0ID0gZGF0YS5yZXN1bHQubGVuZ3RoID8gc2V0Q2F0c1N0YXQoZGF0YS5yZXN1bHQsIGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpKSA6IGRhdGEucmVzdWx0O1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhdGVnb3JpZXNTdGF0IGNhdHN0YXQ6ICcsIHZtLmNhdHN0YXQpO1xuXHRcdFx0XHR2bS5jYXRjaGFydERhdGEgPSBjaGFydFNlcnZpY2Uuc2V0Q2hhcnREYXRhKHZtLmNhdHN0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHZtLmNhdGNoYXJ0TGFiZWwpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhdGVnb3JpZXNTdGF0IHZtLmNhdGNoYXJ0RGF0YTogJywgdm0uY2F0Y2hhcnREYXRhKTtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0U3ViQ2F0ZWdvcmllc1N0YXQoY2F0KXtcblx0XHRcdHZhciBkYXRhLCB0YWJsZXMgPSB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdG1ldHJpY3MgPSBbJ25jYScsICdhdHQnLCAnYWh0JywgJ2FzYScsICdzbCcrdm0uZGF0YS5JbmNvbWluZ19BZ2VudC5zbF07XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0KSBtZXRyaWNzLnB1c2goJ3N1bShjYWxscmVzdWx0KScpO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0cmV0dXJuIGFwaS5nZXRDdXN0b21MaXN0U3RhdGlzdGljcyh7XG5cdFx0XHRcdC8vIHRhYmxlczogWydwcm9ic3RhdCcsICdwcm9iY2F0JywgJ3Byb2JkZXRhaWxzJ10sXG5cdFx0XHRcdHRhYmxlczogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lXSxcblx0XHRcdFx0Ly8gdGFicmVsOiAncHJvYmNhdC5jYXRkZXNjPVwiJytjYXQrJ1wiIGFuZCBwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2JkZXRhaWxzPXByb2JkZXRhaWxzLnN1YmlkJyxcblx0XHRcdFx0dGFicmVsOiBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKyc9JytjYXQrXG5cdFx0XHRcdFx0XHQvLyAnIGFuZCB0YXNrdHlwZSBpbiAoJytnZXRUYXNrS2luZHMoKS5qb2luKCcsJykrJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgdGFza2lkIGluIChcXCcnK2dldFRhc2tJZHMoKS5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZCwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldFN1YkNhdGVnb3JpZXNTdGF0IGRhdGE6ICcsIHJlc3VsdC5kYXRhKTtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhdFByb2Nlc3Nlcyhjb2x1bW5zLCBjYXQsIHN1YmNhdCl7XG5cdFx0XHRpZighY29sdW1ucykgcmV0dXJuO1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzO1xuXHRcdFx0dm0ub3B0aW9ucy50YWJsZXNMaXN0ID0gW3RhYmxlcy5wcm9jZXNzZWQubmFtZSwgdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWVdO1xuXHRcdFx0aWYodGFibGVzLmNvbXBhbmllcykgdm0ub3B0aW9ucy50YWJsZXNMaXN0LnB1c2godGFibGVzLmNvbXBhbmllcy5uYW1lKTtcblxuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdHJldHVybiBhcGkuZ2V0UXVlcnlSZXN1bHRTZXQoe1xuXHRcdFx0XHQvLyB0YWJsZXM6IFsncHJvY2Vzc2VkJywgJ3Byb2JzdGF0JywgJ3Byb2JjYXQnLCAncHJvYmRldGFpbHMnLCAncHJvYmNvbXBhbnknXSxcblx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLnRhYmxlc0xpc3QsXG5cdFx0XHRcdC8vIHRhYnJlbDogKGNhdCA/ICdwcm9iY2F0LmNhdGRlc2M9XCInK2NhdCsnXCIgYW5kICcgOiAnJykgKyAoc3ViY2F0ID8gJ3Byb2JkZXRhaWxzLnByb2JkZXNjPVwiJytzdWJjYXQrJ1wiIGFuZCAnIDogJycpICsgJ3Byb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmRldGFpbHM9cHJvYmRldGFpbHMuc3ViaWQgYW5kIHByb2JzdGF0LnByb2Jjb21wYW55PXByb2Jjb21wYW55LmNvbXBpZCcsXG5cdFx0XHRcdHRhYnJlbDogKGNhdCAhPT0gdW5kZWZpbmVkID8gW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnPScrY2F0KycgYW5kICcgOiAnJykgK1xuXHRcdFx0XHRcdFx0JyB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkICcrXG5cdFx0XHRcdFx0XHQoc3ViY2F0ICE9PSB1bmRlZmluZWQgPyAnIGFuZCAnK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJz0nK3N1YmNhdCA6ICcnKSArXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdCh0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeSAhPT0gdW5kZWZpbmVkID8gJyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgOiAnJykrXG5cdFx0XHRcdFx0XHQodGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueSAhPT0gdW5kZWZpbmVkID8gJyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jb21wYW5pZXMubmFtZSwgdGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgOiAnJykgK1xuXHRcdFx0XHRcdFx0JyBhbmQgcHJvY2Vzc2VkLnByb2NpZD0nK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBjb2x1bW5zLFxuXHRcdFx0XHQvLyBncm91cEJ5OiB0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21tZW50cyxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDYWxsUmVzb2x1dGlvblN0YXQoa2luZCl7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsIHRhc2tLaW5kID0ga2luZC5raW5kLFxuXHRcdFx0bWV0cmljcyA9IFsnY291bnQoY2FsbHJlc3VsdCknXTtcblxuXHRcdFx0cmV0dXJuIGFwaS5nZXRDdXN0b21MaXN0U3RhdGlzdGljcyh7XG5cdFx0XHRcdHRhYmxlczogW3RhYmxlcy5jYWxscy5uYW1lXSxcblx0XHRcdFx0Ly8gdGFicmVsOiAncHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iY29tcGFueT1wcm9iY29tcGFueS5jb21waWQnLFxuXHRcdFx0XHR0YWJyZWw6ICd0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcyhbdGFza0tpbmRdKS5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0J2FuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0uam9pbignLicpKycgPSAxJyxcblx0XHRcdFx0cHJvY2lkOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLFxuXHRcdFx0XHQvLyBjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnksIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKCksXG5cdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRDYWxsUmVzb2x1dGlvblN0YXQgZGF0YTogJywgcmVzdWx0LmRhdGEpO1xuXHRcdFx0XHRpZihyZXN1bHQuZGF0YS5yZXN1bHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dm0uZ2xvYmFsQ3JbdXRpbHMuZ2V0RnJpZW5kbHlLaW5kKHRhc2tLaW5kKV0gPSByZXN1bHQuZGF0YS5yZXN1bHRbMF1bJ2NvdW50KGNhbGxyZXN1bHQpJ107XG5cdFx0XHRcdFx0ZGVidWcubG9nKCdnbG9iYWxDcjogJywgdm0uZ2xvYmFsQ3JbdXRpbHMuZ2V0RnJpZW5kbHlLaW5kKHRhc2tLaW5kKV0pO1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldEdsb2JhbEZyYyhraW5kLCBmdW5jKSB7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRcdHRhc2tLaW5kID0ga2luZC5raW5kLFxuXHRcdFx0XHR0YXNrcyA9IGdldFRhc2tJZHMoW3Rhc2tLaW5kXSk7XG5cblx0XHRcdGRlYnVnLmxvZygnZ2V0R2xvYmFsRnJjIHRhc2tzOicsIGtpbmQsIGZ1bmMpO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUZDUlN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YXNrOiB0YXNrcyxcblx0XHRcdFx0Ly8gdGFzazogdGFza3NbMF0sXG5cdFx0XHRcdC8vIHRhYmxlOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHQvLyBwcm9jaWQ6IHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWQsXG5cdFx0XHRcdGludGVydmFsOiAzNjAwKjI0KjEwMDAsXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKVxuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHR2bS5nbG9iYWxGY3Jba2luZC5uYW1lXSA9IHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGggPyAocmVzdWx0LmRhdGEucmVzdWx0XG5cdFx0XHRcdC5yZWR1Y2UodXRpbHMuZXh0ZW5kQW5kU3VtKSkgOiBbXTtcblx0XHRcdFx0XG5cdFx0XHRcdHZtLmdsb2JhbEZjcltraW5kLm5hbWVdLmZjclJhdGUgPSB2bS5nbG9iYWxGY3Jba2luZC5uYW1lXS5mY3IgLyB2bS5nbG9iYWxGY3Jba2luZC5uYW1lXS50b3RhbCAqIDEwMDtcblxuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldEdsb2JhbEZyYzogJywgdm0uZ2xvYmFsRmNyKTtcblxuXHRcdFx0XHQvLyBnZXQgcHJldiBzdGF0aXN0aWNzXG5cdFx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tRkNSU3RhdGlzdGljcyh7XG5cdFx0XHRcdFx0dGFzazogdGFza3MsXG5cdFx0XHRcdFx0Ly8gdGFibGU6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdFx0Ly8gcHJvY2lkOiB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkLFxuXHRcdFx0XHRcdGludGVydmFsOiAzNjAwKjI0KjEwMDAsXG5cdFx0XHRcdFx0YmVnaW46ICh2bS5iZWdpbi52YWx1ZU9mKCkgLSAodm0uZW5kLnZhbHVlT2YoKSAtIHZtLmJlZ2luLnZhbHVlT2YoKSkpLFxuXHRcdFx0XHRcdGVuZDogdm0uYmVnaW4udmFsdWVPZigpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLnByZXZHbG9iYWxGY3Jba2luZC5uYW1lXSA9IHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGggPyAocmVzdWx0LmRhdGEucmVzdWx0XG5cdFx0XHRcdC5yZWR1Y2UodXRpbHMuZXh0ZW5kQW5kU3VtKSkgOiBbXTtcblx0XHRcdFx0XG5cdFx0XHRcdHZtLnByZXZHbG9iYWxGY3Jba2luZC5uYW1lXS5mY3JSYXRlID0gdm0ucHJldkdsb2JhbEZjcltraW5kLm5hbWVdLmZjciAvIHZtLnByZXZHbG9iYWxGY3Jba2luZC5uYW1lXS50b3RhbCAqIDEwMDtcblxuXHRcdFx0XHRkZWJ1Zy5sb2coJ3ByZXZHbG9iYWxGY3I6ICcsIHZtLnByZXZHbG9iYWxGY3IpO1xuXHRcdFx0fSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRMb2dpbnNSYXRpbyhraW5kKSB7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsIHRhc2tLaW5kID0ga2luZC5raW5kLFxuXHRcdFx0cmRhdGEgPSB7fSxcblx0XHRcdG1ldHJpY3MgPSBbJ2NvdW50KGxvZ2luKSddO1xuXHRcdFx0Ly8gbWV0cmljcyA9IFsnY291bnQoY2FzZSB3aGVuIGxvZ2luICE9IDAgdGhlbiBsb2dpbiBlbHNlIG51bGwgZW5kKSBhcyB0bG9naW5zJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdC8vIHRhYnJlbDogJ3Byb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiAndGFza2lkIGluIChcXCcnK2dldFRhc2tJZHMoW3Rhc2tLaW5kXSkuam9pbignXFwnLFxcJycpKydcXCcpJyArXG5cdFx0XHRcdFx0XHRcImFuZCBcIitbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmxvZ2luXS5qb2luKCcuJykrXCIgIT0gJzAnXCIsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0XSxcblx0XHRcdFx0Ly8gY29sdW1uczogW3RhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0TG9naW5zUmF0aW8gZGF0YTogJywgcmVzdWx0LmRhdGEpO1xuXHRcdFx0XHRpZihyZXN1bHQuZGF0YSAmJiByZXN1bHQuZGF0YS5yZXN1bHQgJiYgcmVzdWx0LmRhdGEucmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHJkYXRhID0gcmVzdWx0LmRhdGEucmVzdWx0O1xuXHRcdFx0XHRcdHZtLnN0YXQgPSB2bS5zdGF0IHx8IHt9O1xuXHRcdFx0XHRcdHZtLnN0YXRbdXRpbHMuZ2V0RnJpZW5kbHlLaW5kKHRhc2tLaW5kKV0gPSB2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldIHx8IHt9O1xuXHRcdFx0XHRcdHZtLnN0YXRbdXRpbHMuZ2V0RnJpZW5kbHlLaW5kKHRhc2tLaW5kKV0ubmN1ID0gcmRhdGEucmVkdWNlKGZ1bmN0aW9uKHByZXYsIG5leHQpIHsgXG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJldiArIG5leHRbJ2NvdW50KGxvZ2luKSddOyBcblx0XHRcdFx0XHR9LCAwKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRkZWJ1Zy5sb2coJ2dldExvZ2luc1JhdGlvIHN0YXQ6ICcsIHZtLnN0YXRbdXRpbHMuZ2V0RnJpZW5kbHlLaW5kKHRhc2tLaW5kKV0pO1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNldENhdHNTdGF0KGRhdGEsIHRvdGFscyl7XG5cdFx0XHR2YXIgZGF0YVZhbHVlO1xuXHRcdFx0XHQvLyB0b3RhbHMgPSBkYXRhLnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXG5cdFx0XHRyZXR1cm4gdXRpbHMuc2V0UGVyY2VudGFnZVZhbHVlcyhkYXRhLCB0b3RhbHMpLm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0YW5ndWxhci5mb3JFYWNoKGl0ZW0sIGZ1bmN0aW9uKHZhbHVlLCBrZXkpe1xuXHRcdFx0XHRcdGRhdGFWYWx1ZSA9IHBhcnNlRmxvYXQodmFsdWUpO1xuXG5cdFx0XHRcdFx0aWYoIWlzTmFOKGRhdGFWYWx1ZSkpIGl0ZW1ba2V5XSA9IGRhdGFWYWx1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gZnVuY3Rpb24gc2V0Q2hhcnREYXRhKGFycmF5LCBkYXRha2V5LCBsYWJlbGtleSl7XG5cdFx0Ly8gXHR2YXIgbmV3QXJyYXkgPSBbXSwgZGF0YSA9IFtdLCBsYWJlbHMgPSBbXSwgY29sb3VycyA9IFtdLCBpdGVtRGF0YTtcblxuXHRcdC8vIFx0c29ydE9iakJ5KGFycmF5LCBkYXRha2V5LCAnZGVzY2VuZCcpXG5cdFx0Ly8gXHQubWFwKGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdC8vIFx0XHRkYXRhLnB1c2goYW5ndWxhci5pc051bWJlcihpdGVtW2RhdGFrZXldKSA/IGl0ZW1bZGF0YWtleV0udG9GaXhlZCgyKSA6IGl0ZW1bZGF0YWtleV0gKTtcblx0XHQvLyBcdFx0bGFiZWxzLnB1c2goaXRlbVtsYWJlbGtleV0pO1xuXHRcdC8vIFx0XHRjb2xvdXJzLnB1c2goZ2V0Q2F0ZWdvcnlDb2xvdXIoaXRlbVtsYWJlbGtleV0pKTtcblx0XHQvLyBcdH0pO1xuXHRcdFx0XG5cdFx0XHRcblx0XHQvLyBcdHN0b3JlLnNldCgnb3B0aW9ucycsIHZtLm9wdGlvbnMpO1xuXG5cdFx0Ly8gXHRyZXR1cm4ge1xuXHRcdC8vIFx0XHRkYXRhOiBkYXRhLFxuXHRcdC8vIFx0XHRsYWJlbHM6IGxhYmVscyxcblx0XHQvLyBcdFx0Y29sb3VyczogY29sb3Vyc1xuXHRcdC8vIFx0fTtcblx0XHQvLyB9XG5cblx0XHQvLyBmdW5jdGlvbiBnZXRDYXRlZ29yeUNvbG91cihjYXQpe1xuXHRcdC8vIFx0dmFyIGNhdENvbG91cnMgPSB2bS5vcHRpb25zLmNhdENvbG91cnMsXG5cdFx0Ly8gXHRcdGZvdW5kID0gZmFsc2UsIGNvbG91ciA9ICcnO1xuXG5cdFx0Ly8gXHRjYXRDb2xvdXJzLmZvckVhY2goZnVuY3Rpb24oaXRlbSl7XG5cdFx0Ly8gXHRcdGlmKGl0ZW0ubmFtZSA9PT0gY2F0KSBmb3VuZCA9IGl0ZW07XG5cdFx0Ly8gXHR9KTtcblxuXHRcdC8vIFx0aWYoZm91bmQpIHtcblx0XHQvLyBcdFx0Y29sb3VyID0gZm91bmQuY29sb3VyO1xuXHRcdC8vIFx0fSBlbHNlIHtcblx0XHQvLyBcdFx0Y29sb3VyID0gY29sb3VyR2VuZXJhdG9yLmdldENvbG9yKCk7XG5cdFx0Ly8gXHRcdHZtLm9wdGlvbnMuY2F0Q29sb3Vycy5wdXNoKHsgbmFtZTogY2F0LCBjb2xvdXI6IGNvbG91ciB9KTtcblx0XHQvLyBcdH1cblx0XHQvLyBcdHJldHVybiBjb2xvdXI7XG5cdFx0Ly8gfVxuXG5cblx0XHQvLyBmdW5jdGlvbiBzb3J0T2JqQnkoYXJyYXksIGtleSwgZGVzY2VuZCl7XG5cdFx0Ly8gXHR2YXIgc29ydGVkID0gYXJyYXkuc29ydChmdW5jdGlvbihhLCBiKXtcblx0XHQvLyBcdFx0aWYoYVtrZXldID4gYltrZXldKSByZXR1cm4gZGVzY2VuZCA/IC0xIDogMTtcblx0XHQvLyBcdFx0aWYoYVtrZXldIDwgYltrZXldKSByZXR1cm4gZGVzY2VuZCA/IDEgOiAtMTtcblx0XHQvLyBcdFx0cmV0dXJuIDA7XG5cdFx0Ly8gXHR9KTtcblx0XHQvLyBcdHJldHVybiBzb3J0ZWQ7XG5cdFx0Ly8gfVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0tpbmRzKCl7XG5cdFx0XHRyZXR1cm4gdm0ub3B0aW9ucy5raW5kcy5tYXAoZnVuY3Rpb24oaXRlbSl7IHJldHVybiBpdGVtLmtpbmQ7IH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFRhc2tJZHMoa2luZHMpe1xuXHRcdFx0dmFyIGlkcyA9IFtdO1xuXHRcdFx0YW5ndWxhci5mb3JFYWNoKHZtLmRhdGEsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpe1xuXHRcdFx0XHRpZih2YWx1ZS5saXN0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdGlmKGtpbmRzKSB7XG5cdFx0XHRcdFx0XHRpZihraW5kcy5pbmRleE9mKHZhbHVlLmtpbmQpID4gLTEpIGlkcy5wdXNoKHZhbHVlLmxpc3QpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZHMucHVzaCh2YWx1ZS5saXN0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZihpZHMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiBpZHMucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cnIpe1xuXHRcdFx0XHRcdHJldHVybiBwcmV2LmNvbmNhdChjdXJyKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gaWRzO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFycmF5VG9JbihhcnJheSkge1xuXHRcdFx0cmV0dXJuIFwiKCdcIiArIGFycmF5LmpvaW4oXCInLCdcIikgKyBcIicpXCI7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2Rhc2hib2FyZCcsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2Rhc2hib2FyZC5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoVm0nXG5cdFx0fSk7XG59XSk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignS2luZFNldHRpbmdzQ29udHJvbGxlcicsIEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRtZERpYWxvZycsICdraW5kJywgJ2xpc3QnLCAndGFza3MnLCAna2luZE1ldHJpY3MnLCAnbWV0cmljcycsICdzbCcsICdkZWZhdWx0U0wnXTtcblxuXHRmdW5jdGlvbiBLaW5kU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCBraW5kLCBsaXN0LCB0YXNrcywga2luZE1ldHJpY3MsIG1ldHJpY3MsIHNsLCBkZWZhdWx0U0wpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS5raW5kID0ga2luZDtcblx0XHR2bS5saXN0ID0gW10uY29uY2F0KGxpc3QpO1xuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKS5zb3J0KCk7XG5cdFx0dm0ua2luZE1ldHJpY3MgPSBbXS5jb25jYXQoa2luZE1ldHJpY3MpO1xuXHRcdHZtLm1ldHJpY3MgPSBbXS5jb25jYXQobWV0cmljcyk7XG5cdFx0dm0uc2wgPSBzbDtcblx0XHR2bS5kZWZhdWx0U0wgPSBkZWZhdWx0U0w7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5leGlzdHMgPSBleGlzdHM7XG5cdFx0dm0uc2VsZWN0QWxsVGFza3MgPSBzZWxlY3RBbGxUYXNrcztcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdHJldHVybiB2bS5saXN0Lmxlbmd0aDtcblx0XHR9LCBmdW5jdGlvbih2YWwpe1xuXHRcdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ2tpbmQgc2V0dHM6Jywgdm0ubGlzdCk7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNsOiB2bS5zbCxcblx0XHRcdFx0bWV0cmljczogdm0ua2luZE1ldHJpY3MsXG5cdFx0XHRcdGxpc3Q6IHZtLmxpc3Rcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0ubGlzdCA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLmxpc3QgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gbGlzdC5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0aWYgKGlkeCA+IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXInLCBQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyKTtcblxuXHRQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckZmlsdGVyJywgJyRtZERpYWxvZycsICd0YWJsZXMnLCAnYmVnaW4nLCAnZW5kJywgJ2RhdGEnLCAndXRpbHNTZXJ2aWNlJywgJ2RlYnVnU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIFByb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXIoJHNjb3BlLCAkZmlsdGVyLCAkbWREaWFsb2csIHRhYmxlcywgYmVnaW4sIGVuZCwgZGF0YSwgdXRpbHMsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXG5cdFx0ZGVidWcubG9nKCdQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyOiAnLCB2bS5kYXRhKTtcblxuXHRcdHZtLm9yZGVyID0gJ2RhdGUnO1xuXHRcdHZtLnNlYXJjaCA9ICcnO1xuXHRcdHZtLmZpbHRlciA9IHtcblx0XHRcdGNhbGxyZXN1bHQ6ICcnXG5cdFx0fTtcblxuXHRcdHZtLmV4cG9ydE5hbWUgPSAncHJvY2Vzc2VzJztcblx0XHQvLyB2bS5leHBvcnROYW1lID0gJGZpbHRlcignZGF0ZScpKHZtLmJlZ2luLCAnZGQuTU0ueXknKSArICctJyArICRmaWx0ZXIoJ2RhdGUnKSh2bS5lbmQsICdkZC5NTS55eScpO1xuXG5cdFx0dm0uZmlsdGVyQnlSZXN1bHQgPSBmdW5jdGlvbihhY3R1YWwsIGV4cGVjdGVkKSB7XG5cdFx0XHRyZXR1cm4gdm0uZmlsdGVyLmNhbGxyZXN1bHQgPyAoYWN0dWFsLmNhbGxyZXN1bHQudG9TdHJpbmcoKSA9PT0gdm0uZmlsdGVyLmNhbGxyZXN1bHQpIDogdHJ1ZTtcblxuXHRcdH07XG5cblx0XHR2bS5jbG9zZSA9IGZ1bmN0aW9uKCl7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSgpO1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmRpcmVjdGl2ZSgnc3RhdENhcmQnLCBzdGF0Q2FyZCk7XG5cblx0ZnVuY3Rpb24gc3RhdENhcmQoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHJlcGxhY2U6IHRydWUsXG5cdFx0XHRzY29wZToge1xuXHRcdFx0XHRtb2RlbDogJ0AnLFxuXHRcdFx0XHR0aXRsZTogJ0AnLFxuXHRcdFx0XHRzdWJoZWFkOiAnQCcsXG5cdFx0XHRcdHByZXZzdGF0OiAnQCcsXG5cdFx0XHRcdGR5bmFtaWNzOiAnQCcsXG5cdFx0XHRcdGNhcmRDbGFzczogJ0AnLFxuXHRcdFx0XHRmbGV4VmFsdWU6ICdAJ1xuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlVXJsOiAnYXNzZXRzL3BhcnRpYWxzL2NhcmQuaHRtbCdcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5jcnInKVxuXHRcdC5jb250cm9sbGVyKCdGY3JTZXR0aW5nc0NvbnRyb2xsZXInLCBGY3JTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdEZjclNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckc2NvcGUnLCAnJG1kRGlhbG9nJywgJ3Rhc2tzJywgJ2NhdHMnLCAnc3ViY2F0cycsICdzZWxlY3RlZENhdHMnLCAnc2VsZWN0ZWRTdWJjYXRzJywgJ3NlbGVjdGVkVGFza3MnLCAnZGVidWdTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gRmNyU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCB0YXNrcywgY2F0cywgc3ViY2F0cywgc2VsZWN0ZWRDYXRzLCBzZWxlY3RlZFN1YmNhdHMsIHNlbGVjdGVkVGFza3MsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0udGFza3MgPSBbXS5jb25jYXQodGFza3MpO1xuXHRcdHZtLnNlbGVjdGVkVGFza3MgPSBbXS5jb25jYXQoc2VsZWN0ZWRUYXNrcyk7XG5cdFx0dm0uY2F0cyA9IGNhdHM7XG5cdFx0dm0uc3ViY2F0cyA9IHN1YmNhdHM7XG5cdFx0dm0uc2VsZWN0ZWRDYXRzID0gW10uY29uY2F0KHNlbGVjdGVkQ2F0cyk7XG5cdFx0dm0uc2VsZWN0ZWRTdWJjYXRzID0gW10uY29uY2F0KHNlbGVjdGVkU3ViY2F0cyk7XG5cdFx0dm0uc2VsZWN0QWxsVGFza3MgPSBzZWxlY3RBbGxUYXNrcztcblx0XHR2bS5zZWxlY3RBbGxDYXRzID0gc2VsZWN0QWxsQ2F0cztcblx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gKHRhc2tzLmxlbmd0aCA9PT0gc2VsZWN0ZWRUYXNrcy5sZW5ndGgpO1xuXHRcdHZtLmFsbENhdHNTZWxlY3RlZCA9IChjYXRzLmxlbmd0aCA9PT0gc2VsZWN0ZWRDYXRzLmxlbmd0aCk7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5pbmRleCA9IGluZGV4O1xuXHRcdHZtLmV4aXN0cyA9IGV4aXN0cztcblx0XHR2bS5zaG93U3ViY2F0cyA9IHNob3dTdWJjYXRzO1xuXHRcdHZtLnNlbGVjdENhdCA9IHNlbGVjdENhdDtcblx0XHR2bS5zZWxlY3RlZENhdCA9IG51bGw7XG5cblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCl7XG5cdFx0XHRyZXR1cm4gdm0uc2VsZWN0ZWRUYXNrcy5sZW5ndGg7XG5cdFx0fSwgZnVuY3Rpb24odmFsKXtcblx0XHRcdHZtLmFsbFRhc2tzU2VsZWN0ZWQgPSB2bS5zZWxlY3RlZFRhc2tzLmxlbmd0aCA9PT0gdm0udGFza3MubGVuZ3RoO1xuXHRcdH0pO1xuXG5cdFx0ZGVidWcubG9nKCd0YXNrc20gc2VsZWN0ZWRUYXNrczogJywgdm0udGFza3MsIHZtLnNlbGVjdGVkVGFza3MpO1xuXHRcdGRlYnVnLmxvZygndGFza3NtIHNlbGVjdGVkQ2F0czogJywgdm0uY2F0cywgdm0uc2VsZWN0ZWRDYXRzKTtcblx0XHRkZWJ1Zy5sb2coJ3Rhc2tzbSBzZWxlY3RlZFN1YmNhdHM6ICcsIHZtLmNhdHMsIHZtLnNlbGVjdGVkU3ViY2F0cyk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRzZWxlY3RlZFRhc2tzOiB2bS5zZWxlY3RlZFRhc2tzLFxuXHRcdFx0XHRzZWxlY3RlZENhdHM6IHZtLnNlbGVjdGVkQ2F0cyxcblx0XHRcdFx0c2VsZWN0ZWRTdWJjYXRzOiB2bS5zZWxlY3RlZFN1YmNhdHNcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNsb3NlU2V0dGluZ3MoKSB7XG5cdFx0XHQkbWREaWFsb2cuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2hvd1N1YmNhdHMoY2F0aWQpIHtcblx0XHRcdHZtLnNlbGVjdGVkQ2F0ID0gY2F0aWQ7XG5cdFx0XHRjb25zb2xlLmxvZygnc2hvd1N1YmNhdHM6ICcsIGNhdGlkKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZWxlY3RDYXQoY2F0aWQsIGNoZWNrZWQpIHtcblx0XHRcdGRlYnVnLmxvZygnc2VsZWN0Q2F0OiAnLCBjaGVja2VkLCBjYXRpZCk7XG5cdFx0XHR0b2dnbGUoY2F0aWQsIHZtLnNlbGVjdGVkQ2F0cyk7XG5cdFx0XHRpZighY2hlY2tlZCkgc2VsZWN0QWxsU3ViY2F0cyhjYXRpZCk7XG5cdFx0XHRlbHNlIGRlc2VsZWN0QWxsU3ViY2F0cyhjYXRpZCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0QWxsVGFza3MoKSB7XG5cdFx0XHRpZih2bS5hbGxUYXNrc1NlbGVjdGVkKSB2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHRcdGVsc2Ugdm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbENhdHMoKSB7XG5cdFx0XHRpZih2bS5hbGxDYXRzU2VsZWN0ZWQpIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRDYXRzID0gW10uY29uY2F0KGNhdHMpLm1hcChmdW5jdGlvbihpdGVtKSB7IHJldHVybiBpdGVtLmlkIH0pO1xuXHRcdFx0XHRzZWxlY3RBbGxTdWJjYXRzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2bS5zZWxlY3RlZENhdHMgPSBbXTtcblx0XHRcdFx0ZGVzZWxlY3RBbGxTdWJjYXRzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0QWxsU3ViY2F0cyhjYXRpZCkge1xuXHRcdFx0dmFyIGNhdFN1YmNhdHMgPSB2bS5zdWJjYXRzLmZpbHRlcihmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiBpdGVtLmNhdGlkID09PSBjYXRpZDtcblx0XHRcdH0pXG5cdFx0XHQubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0uaWQ7XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYoY2F0aWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR2bS5zZWxlY3RlZFN1YmNhdHMgPSB2bS5zZWxlY3RlZFN1YmNhdHMuY29uY2F0KGNhdFN1YmNhdHMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzLmxlbmd0aCA9IDA7IFxuXHRcdFx0XHR2bS5zZWxlY3RlZFN1YmNhdHMgPSB2bS5zZWxlY3RlZFN1YmNhdHMuY29uY2F0KHZtLnN1YmNhdHMubWFwKGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIGl0ZW0uaWQgfSkpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRkZWJ1Zy5sb2coJ3NlbGVjdEFsbFN1YmNhdHM6ICcsIGNhdGlkLCBjYXRTdWJjYXRzLCB2bS5zZWxlY3RlZFN1YmNhdHMpO1xuXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZGVzZWxlY3RBbGxTdWJjYXRzKGNhdGlkKSB7XG5cdFx0XHR2YXIgY2F0U3ViY2F0cyA9IHZtLnN1YmNhdHMuZmlsdGVyKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0uY2F0aWQgPT09IGNhdGlkO1xuXHRcdFx0fSlcblx0XHRcdC5tYXAoZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0XHRyZXR1cm4gaXRlbS5pZDtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZihjYXRpZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNhdFN1YmNhdHMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdFx0aWYodm0uc2VsZWN0ZWRTdWJjYXRzLmluZGV4T2YoaXRlbSkgIT09IC0xKVxuXHRcdFx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzLnNwbGljZSh2bS5zZWxlY3RlZFN1YmNhdHMuaW5kZXhPZihpdGVtKSwgMSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzLmxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0b2dnbGUoaXRlbSwgbGlzdCkge1xuXHRcdFx0dmFyIGlkeCA9IGluZGV4KGl0ZW0sIGxpc3QpO1xuXHRcdFx0aWYgKGlkeCAhPT0gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0gPT0gaXRlbSkgaWR4ID0gaW5kZXg7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBpZHg7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmZjcicpXG5cdFx0LmNvbnRyb2xsZXIoJ0ZjckNvbnRyb2xsZXInLCBGY3JDb250cm9sbGVyKTtcblxuXHRGY3JDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJHEnLCAnJG1kRGlhbG9nJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ3N0b3JlJywgJ1Rhc2tzU2VydmljZScsICd1dGlsc1NlcnZpY2UnLCAnZGVidWdTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2NoYXJ0U2VydmljZScsICdlcnJvclNlcnZpY2UnXTtcblxuXHRmdW5jdGlvbiBGY3JDb250cm9sbGVyKCRyb290U2NvcGUsICRxLCAkbWREaWFsb2csIFNldHRpbmdzU2VydmljZSwgYXBpLCBzdG9yZSwgVGFza3NTZXJ2aWNlLCB1dGlscywgZGVidWcsIHNwaW5uZXJTZXJ2aWNlLCBjaGFydFNlcnZpY2UsIGVycm9yU2VydmljZSkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblx0XHR2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG5cdFx0XHRwZXJpb2Q6ICcxIG1vbnRoJyxcblx0XHRcdGludGVydmFsOiAzNjAwKjI0KjEwMDBcblx0XHR9O1xuXHRcdHZhciBjYXRGY3IgPSB7fTtcblx0XHR2YXIgc3ViY2F0RmNyID0ge307XG5cdFx0dmFyIGFnZW50c0ZjciA9IHt9O1xuXHRcdHZhciB3aXRoU3ViY2F0cyA9IHRydWU7XG5cblx0XHR2bS5zZXR0aW5ncyA9IHt9O1xuXHRcdHZtLnRhc2tzID0gW107XG5cdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdHZtLnNlbGVjdGVkQ2F0ID0gbnVsbDtcblx0XHR2bS5zZWxlY3RlZFN1YmNhdCA9IG51bGw7XG5cdFx0dm0uY2F0cyA9IFtdO1xuXHRcdHZtLnN1YmNhdHMgPSBbXTtcblx0XHR2bS5zZWxlY3RlZENhdHMgPSBbXTtcblx0XHR2bS5zZWxlY3RlZFN1YmNhdHMgPSBbXTtcblx0XHR2bS5hZ2VudHNGY3IgPSBbXTtcblx0XHR2bS50b3RhbEFnZW50c0ZjciA9IFtdO1xuXHRcdHZtLmNhdEZjciA9IFtdO1xuXHRcdHZtLnRvdGFsQ2F0RmNyID0gW107XG5cdFx0dm0uc3ViY2F0RmNyID0gW107XG5cdFx0dm0udG90YWxTdWJjYXRGY3IgPSBbXTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdE9wdGlvbnMucGVyaW9kKS5iZWdpbjtcblx0XHR2bS5lbmQgPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRPcHRpb25zLnBlcmlvZCkuZW5kO1xuXHRcdHZtLmdldENhdEZjciA9IGdldENhdEZjcjtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0udGFibGVTb3J0ID0gJ2ZjclJhdGUnO1xuXHRcdHZtLmdldEZjciA9IGdldEZjcjtcblx0XHR2bS5nZXRBZ2VudEZjciA9IGdldEFnZW50RmNyO1xuXHRcdHZtLm9uQ2F0U2VsZWN0ID0gb25DYXRTZWxlY3Q7XG5cdFx0dm0ub25TdWJjYXRTZWxlY3QgPSBvblN1YmNhdFNlbGVjdDtcblx0XHR2bS5jb3VudEZjciA9IGNvdW50RmNyO1xuXHRcdHZtLmRhdGEgPSBzdG9yZS5nZXQoJ2RhdGEnKTtcblxuXHRcdGluaXQoKTtcblx0XHRzcGlubmVyU2VydmljZS5zaG93KCdtYWluLWxvYWRlcicpO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdCgpIHtcblx0XHRcdFNldHRpbmdzU2VydmljZS5nZXRTZXR0aW5ncygpXG5cdFx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdFx0dm0uc2V0dGluZ3MgPSBkYlNldHRpbmdzO1xuXHRcdFx0XHRpZighdm0uc2V0dGluZ3MudGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5jYXRlZ29yeV9pZCkgXG5cdFx0XHRcdFx0d2l0aFN1YmNhdHMgPSBmYWxzZTtcblxuXHRcdFx0XHQvLyByZXR1cm4gVGFza3NTZXJ2aWNlLmdldFRhc2tMaXN0KDEpO1xuXHRcdFx0XHRyZXR1cm4gZ2V0VGFza0xpc3Qodm0uZGF0YSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24odGFza3MpIHtcblx0XHRcdFx0ZGVidWcubG9nKCd0YXNrczogJywgdGFza3MpO1xuXHRcdFx0XHR2bS50YXNrcyA9IHRhc2tzO1xuXHRcdFx0XHR2bS5zZWxlY3RlZFRhc2tzID0gc3RvcmUuZ2V0KCdzZWxlY3RlZFRhc2tzJykgfHwgdGFza3M7XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0cyA9IHN0b3JlLmdldCgnc2VsZWN0ZWRDYXRzJykgfHwgW107XG5cdFx0XHRcdHZtLnNlbGVjdGVkU3ViY2F0cyA9IHN0b3JlLmdldCgnc2VsZWN0ZWRTdWJjYXRzJykgfHwgW107XG5cblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihnZXRDYXRlZ29yaWVzKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKHdpdGhTdWJjYXRzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdldFN1YmNhdGVnb3JpZXMoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0XHQudGhlbihnZXRGY3IpXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldEZjcigpIHtcblx0XHRcdHJldHVybiBnZXRBZ2VudEZjcigpXG5cdFx0XHQudGhlbihnZXRDYXRGY3IpXG5cdFx0XHQudGhlbihnZXRTdWJjYXRGY3IpXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlblNldHRpbmdzKCRldmVudCkge1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Zjci9mY3Itc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdGY3JTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdmY3JTZXR0c1ZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdHRhc2tzOiB2bS50YXNrcyxcblx0XHRcdFx0XHRjYXRzOiB2bS5jYXRzLFxuXHRcdFx0XHRcdHN1YmNhdHM6IHZtLnN1YmNhdHMsXG5cdFx0XHRcdFx0c2VsZWN0ZWRDYXRzOiB2bS5zZWxlY3RlZENhdHMsXG5cdFx0XHRcdFx0c2VsZWN0ZWRTdWJjYXRzOiB2bS5zZWxlY3RlZFN1YmNhdHMsXG5cdFx0XHRcdFx0c2VsZWN0ZWRUYXNrczogdm0uc2VsZWN0ZWRUYXNrc1xuXHRcdFx0XHR9XG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHR2bS5zZWxlY3RlZFRhc2tzID0gcmVzdWx0LnNlbGVjdGVkVGFza3M7XG5cdFx0XHRcdHZtLnNlbGVjdGVkQ2F0cyA9IHJlc3VsdC5zZWxlY3RlZENhdHM7XG5cdFx0XHRcdHZtLnNlbGVjdGVkU3ViY2F0cyA9IHJlc3VsdC5zZWxlY3RlZFN1YmNhdHM7XG5cblx0XHRcdFx0c3RvcmUuc2V0KCdzZWxlY3RlZFRhc2tzJywgdm0uc2VsZWN0ZWRUYXNrcyk7XG5cdFx0XHRcdHN0b3JlLnNldCgnc2VsZWN0ZWRDYXRzJywgdm0uc2VsZWN0ZWRDYXRzKTtcblx0XHRcdFx0c3RvcmUuc2V0KCdzZWxlY3RlZFN1YmNhdHMnLCB2bS5zZWxlY3RlZFN1YmNhdHMpO1xuXG5cdFx0XHRcdGRlYnVnLmxvZygnb3BlblNldHRpbmdzIGNsb3NlZDogJywgdm0uc2VsZWN0ZWRDYXRzLCB2bS5zZWxlY3RlZFN1YmNhdHMpO1xuXG5cdFx0XHRcdGdldEZjcigpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gZnVuY3Rpb24gc2V0Q2hhcnRzKCkge1xuXHRcdC8vIFx0dm0uY2F0Q2hhcnREYXRhID0gY2hhcnRTZXJ2aWNlLnNldENoYXJ0RGF0YSh2bS5hZ2VudHNGY3IsICdmY3JSYXRlJywgJ2FnZW50Jyk7XG5cdFx0Ly8gXHR2bS5hQ2hhcnREYXRhID0gY2hhcnRTZXJ2aWNlLnNldENoYXJ0RGF0YSh2bS5jYXRGY3IsICdmY3JSYXRlJywgJ2NhdGRlc2MnKTtcblx0XHQvLyBcdGRlYnVnLmxvZygndm0uY2F0Q2hhcnREYXRhOiAnLCB2bS5jYXRDaGFydERhdGEpO1xuXHRcdC8vIFx0ZGVidWcubG9nKCd2bS5hQ2hhcnREYXRhOiAnLCB2bS5hQ2hhcnREYXRhKTtcblx0XHQvLyB9XG5cblx0XHRmdW5jdGlvbiBnZXRDYXRlZ29yaWVzKCl7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXHRcdFx0dmFyIGNvbHVtbnMgPSBbXG5cdFx0XHRcdFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXS5qb2luKCcuJyksXG5cdFx0XHRcdFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJylcblx0XHRcdF07XG5cdFx0XHRcblx0XHRcdHJldHVybiBhcGkuZ2V0UXVlcnlSZXN1bHRTZXQoe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lXSxcblx0XHRcdFx0Y29sdW1uczogY29sdW1ucyxcblx0XHRcdFx0Z3JvdXBCeTogW3RhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJywnKVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihjYXRzKXtcblx0XHRcdFx0dm0uY2F0cyA9IGNhdHMuZGF0YS5yZXN1bHQubGVuZ3RoID8gKGNhdHMuZGF0YS5yZXN1bHQubWFwKGZ1bmN0aW9uKGNhdCkgeyByZXR1cm4geyBkZXNjOiBjYXRbMF0sIGlkOiBjYXRbMV0gfSB9KSkgOiBbXTtcblx0XHRcdFx0dm0uc2VsZWN0ZWRDYXRzID0gdm0uc2VsZWN0ZWRDYXRzLmxlbmd0aCA/IHZtLnNlbGVjdGVkQ2F0cyA6IFtdLmNvbmNhdCh2bS5jYXRzKS5tYXAoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gaXRlbS5pZCB9KTtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRDYXRlZ29yaWVzOiAnLCB2bS5jYXRzLCB2bS5zZWxlY3RlZENhdHMpO1xuXG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdWJjYXRlZ29yaWVzKCl7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXHRcdFx0dmFyIGNvbHVtbnMgPSBbXG5cdFx0XHRcdFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXS5qb2luKCcuJyksXG5cdFx0XHRcdFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJyksXG5cdFx0XHRcdFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXS5qb2luKCcuJyksXG5cdFx0XHRcdFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJylcblx0XHRcdF07XG5cdFx0XHRcblx0XHRcdHJldHVybiBhcGkuZ2V0UXVlcnlSZXN1bHRTZXQoe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lXSxcblx0XHRcdFx0Y29sdW1uczogY29sdW1ucyxcblx0XHRcdFx0dGFicmVsOiB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lKycuJyt0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmNhdGVnb3J5X2lkKyc9Jyt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lKycuJyt0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkLFxuXHRcdFx0XHRncm91cEJ5OiBbdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSsnLicrdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZCwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbiwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLCcpXG5cdFx0XHRcdC8vIGdyb3VwQnk6IFt0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihzdWJjYXRzKXtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRTdWJjYXRlZ29yaWVzOiAnLCBzdWJjYXRzKTtcblx0XHRcdFx0dm0uc3ViY2F0cyA9IHN1YmNhdHMuZGF0YS5yZXN1bHQubGVuZ3RoID8gKHN1YmNhdHMuZGF0YS5yZXN1bHQubWFwKGZ1bmN0aW9uKHN1YmNhdCkgeyByZXR1cm4geyBjYXRpZDogc3ViY2F0WzFdLCBkZXNjOiBzdWJjYXRbMl0sIGlkOiBzdWJjYXRbM10gfSB9KSkgOiBbXTtcblx0XHRcdFx0dm0uc2VsZWN0ZWRTdWJjYXRzID0gdm0uc2VsZWN0ZWRTdWJjYXRzLmxlbmd0aCA/IHZtLnNlbGVjdGVkU3ViY2F0cyA6IFtdLmNvbmNhdCh2bS5zdWJjYXRzKS5tYXAoZnVuY3Rpb24oaXRlbSkgeyByZXR1cm4gaXRlbS5pZCB9KTtcblxuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QWdlbnRGY3IoKSB7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXHRcdFx0dmFyIG9wdHMgPSB7XG5cdFx0XHRcdHRhc2s6IHZtLnNlbGVjdGVkVGFza3MsXG5cdFx0XHRcdHRhYmxlOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRpbnRlcnZhbDogMzYwMCoyNCoxMDAwLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLCBcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpXG5cdFx0XHR9XG5cblx0XHRcdGlmKCF2bS5zZWxlY3RlZENhdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdhZ2VudHMtZmNyLWxvYWRlcicpO1xuXHRcdFx0XG5cdFx0XHRvcHRzLnRhYmxlLnB1c2godGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSk7XG5cdFx0XHRvcHRzLndoZXJlID0gW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JysgW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKTtcblx0XHRcdG9wdHMud2hlcmUgKz0gJyBhbmQgJyArIFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrIFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJyk7XG5cdFx0XHRpZih3aXRoU3ViY2F0cylcblx0XHRcdFx0b3B0cy53aGVyZSArPSAnIGFuZCAnICsgW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnIGluICcrYXJyYXlUb0luKHZtLnNlbGVjdGVkU3ViY2F0cyk7XG5cblx0XHRcdC8vIGlmIGNhdGVnb3J5IHNlbGVjdGVkIFxuXHRcdFx0aWYodm0uc2VsZWN0ZWRDYXQgIT09IG51bGwpIHtcblx0XHRcdFx0b3B0cy53aGVyZSArPSAnIGFuZCAnICsgW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLmpvaW4oJy4nKSsnPVxcJycrdm0uc2VsZWN0ZWRDYXQrJ1xcJyc7XG5cblx0XHRcdFx0Ly8gaWYgc3ViY2F0ZWdvcnkgc2VsZWN0ZWQgXG5cdFx0XHRcdGlmKHZtLnNlbGVjdGVkU3ViY2F0ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0b3B0cy53aGVyZSArPSAnIGFuZCAnICsgW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLmpvaW4oJy4nKSsnPVxcJycrdm0uc2VsZWN0ZWRTdWJjYXQrJ1xcJyc7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBcblx0XHRcdGVsc2UgaWYodm0uc2VsZWN0ZWRDYXRzLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBnZXQgYWdlbnRzIEZDUiBvbmx5IHdpdGggc2VsZWN0ZWQgY2F0ZWdvcmllc1xuXHRcdFx0XHRvcHRzLndoZXJlICs9ICcgYW5kICcgKyBbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKycgaW4gJythcnJheVRvSW4odm0uc2VsZWN0ZWRDYXRzKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGFwaS5nZXRGQ1JTdGF0aXN0aWNzKG9wdHMpXG5cdFx0XHQudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0YWdlbnRzRmNyID0gYXJyYXlUb09iamVjdEFuZFN1bShyZXN1bHQuZGF0YS5yZXN1bHQsICdhZ2VudCcpO1xuXHRcdFx0XHR2bS5hZ2VudHNGY3IgPSBPYmplY3Qua2V5cyhhZ2VudHNGY3IpLm1hcChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0XHRyZXR1cm4gYWdlbnRzRmNyW2tleV07XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5tYXAoY291bnRGY3IpO1xuXG5cdFx0XHRcdHZtLnRvdGFsQWdlbnRzRmNyID0gdm0uYWdlbnRzRmNyLmxlbmd0aCA/IHZtLmFnZW50c0Zjci5yZWR1Y2Uoc3VtT2JqZWN0cykgOiBbXTtcblxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdhZ2VudHMtZmNyLWxvYWRlcicpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldEFnZW50RmNyOiAnLCB2bS5hZ2VudHNGY3IpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0RmNyKCkge1xuXHRcdFx0XG5cdFx0XHRpZighdm0uc2VsZWN0ZWRDYXRzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcyxcblx0XHRcdFx0cGFyYW1zID0ge1xuXHRcdFx0XHRcdHRhc2s6IHZtLnNlbGVjdGVkVGFza3MsXG5cdFx0XHRcdFx0dGFibGU6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZV0sXG5cdFx0XHRcdFx0d2hlcmU6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSArXG5cdFx0XHRcdFx0XHRcdCcgYW5kICcgKyBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgK1xuXHRcdFx0XHRcdFx0XHQnIGFuZCAnICsgW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnIGluICcrYXJyYXlUb0luKHZtLnNlbGVjdGVkQ2F0cykgK1xuXHRcdFx0XHRcdFx0XHQod2l0aFN1YmNhdHMgPyAnIGFuZCAnICsgW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnIGluICcrYXJyYXlUb0luKHZtLnNlbGVjdGVkU3ViY2F0cykgOiAnJyksXG5cdFx0XHRcdFx0cHJvY2lkOiB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkLFxuXHRcdFx0XHRcdGNvbHVtbjogW3RhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24sIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHRcdGludGVydmFsOiBkZWZhdWx0T3B0aW9ucy5pbnRlcnZhbCxcblx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXQtZmNyLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUZDUlN0YXRpc3RpY3MocGFyYW1zKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdGNhdEZjciA9IGFycmF5VG9PYmplY3RBbmRTdW0ocmVzdWx0LmRhdGEucmVzdWx0LCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uKTtcblx0XHRcdFx0dm0uY2F0RmNyID0gT2JqZWN0LmtleXMoY2F0RmNyKVxuXHRcdFx0XHQubWFwKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdHJldHVybiBjYXRGY3Jba2V5XTtcblx0XHRcdFx0fSlcblx0XHRcdFx0Lm1hcChjb3VudEZjcik7XG5cblx0XHRcdFx0dm0udG90YWxDYXRGY3IgPSB2bS5jYXRGY3IubGVuZ3RoID8gdm0uY2F0RmNyLnJlZHVjZShzdW1PYmplY3RzKSA6IFtdO1xuXG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2NhdC1mY3ItbG9hZGVyJyk7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0Q2F0RmNyOiAnLCB2bS5jYXRGY3IsIHZtLnRvdGFsQ2F0RmNyKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN1YmNhdEZjcigpIHtcblx0XHRcdC8vIHNwaW5uZXJTZXJ2aWNlLnNob3coJ2Zjci1sb2FkZXInKTtcblx0XHRcdHZhciB0YWJsZXMgPSB2bS5zZXR0aW5ncy50YWJsZXM7XG5cblx0XHRcdGlmKHZtLnNlbGVjdGVkQ2F0ID09PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXQtZmNyLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUZDUlN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YXNrOiB2bS5zZWxlY3RlZFRhc2tzLFxuXHRcdFx0XHR0YWJsZTogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lXSxcblx0XHRcdFx0d2hlcmU6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXS5qb2luKCcuJykgKyAnPVxcJycgKyB2bS5zZWxlY3RlZENhdCArICdcXCcgYW5kICcgK1xuXHRcdFx0XHRcdFx0W3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpICsgJyBhbmQgJyArXG5cdFx0XHRcdFx0XHRbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgK1xuXHRcdFx0XHRcdFx0JyBhbmQgJyArIFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJyBpbiAnK2FycmF5VG9Jbih2bS5zZWxlY3RlZFN1YmNhdHMpLFxuXHRcdFx0XHRwcm9jaWQ6IHRhYmxlcy5jYWxscy5jb2x1bW5zLnByb2Nlc3NfaWQsXG5cdFx0XHRcdGNvbHVtbjogW3RhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLFxuXHRcdFx0XHRpbnRlcnZhbDogZGVmYXVsdE9wdGlvbnMuaW50ZXJ2YWwsXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKVxuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRzdWJjYXRGY3IgPSBhcnJheVRvT2JqZWN0QW5kU3VtKHJlc3VsdC5kYXRhLnJlc3VsdCwgJ3Byb2JkZXNjJyk7XG5cdFx0XHRcdHZtLnN1YmNhdEZjciA9IE9iamVjdC5rZXlzKHN1YmNhdEZjcilcblx0XHRcdFx0Lm1hcChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0XHRyZXR1cm4gc3ViY2F0RmNyW2tleV07XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5tYXAoY291bnRGY3IpO1xuXG5cdFx0XHRcdHZtLnRvdGFsU3ViY2F0RmNyID0gdm0uc3ViY2F0RmNyLnJlZHVjZShzdW1PYmplY3RzKTtcblxuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXQtZmNyLWxvYWRlcicpO1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldFN1YmNhdEZjcjogJywgdm0uc3ViY2F0RmNyLCB2bS50b3RhbFN1YmNhdEZjcik7XG5cdFx0XHR9KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvbkNhdFNlbGVjdChjYXQpIHtcblx0XHRcdGRlYnVnLmxvZygnb25DYXRTZWxlY3Q6ICcsIGNhdCk7XG5cdFx0XHR2bS5zZWxlY3RlZENhdCA9IGNhdDtcblx0XHRcdFxuXHRcdFx0Z2V0QWdlbnRGY3IoKVxuXHRcdFx0LnRoZW4oZ2V0U3ViY2F0RmNyKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvblN1YmNhdFNlbGVjdChzdWJjYXQpIHtcblx0XHRcdGRlYnVnLmxvZygnb25TdWJjYXRTZWxlY3Q6ICcsIHN1YmNhdCk7XG5cdFx0XHR2bS5zZWxlY3RlZFN1YmNhdCA9IHN1YmNhdDtcblx0XHRcdGdldEFnZW50RmNyKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY291bnRGY3Iob2JqKSB7XG5cdFx0XHRvYmouZmNyUmF0ZSA9IG9iai5mY3IgLyBvYmoudG90YWwgKiAxMDA7XG5cdFx0XHRyZXR1cm4gb2JqXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0xpc3QoZGF0YSkge1xuXHRcdFx0dmFyIHRhc2tzID0gW107XG5cdFx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0dGFza3MgPSB0YXNrcy5jb25jYXQoZGF0YVtpdGVtXS50YXNrcyk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0YXNrcztcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhcnJheVRvT2JqZWN0QW5kU3VtKGFycmF5LCBwcm9wTmFtZSkge1xuXHRcdFx0aWYoIWFycmF5Lmxlbmd0aCkgcmV0dXJuIGFycmF5O1xuXG5cdFx0XHRyZXR1cm4gYXJyYXkucmVkdWNlKGZ1bmN0aW9uKHByZXYsIG5leHQpIHtcblx0XHRcdFx0aWYobmV4dC5oYXNPd25Qcm9wZXJ0eShwcm9wTmFtZSkpIHtcblx0XHRcdFx0XHRwcmV2W25leHRbcHJvcE5hbWVdXSA9IHByZXZbbmV4dFtwcm9wTmFtZV1dID8gc3VtT2JqZWN0cyhuZXh0LCBwcmV2W25leHRbcHJvcE5hbWVdXSkgOiBuZXh0O1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdHJldHVybiBwcmV2O1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB7fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXJyYXlUb0luKGFycmF5KSB7XG5cdFx0XHRyZXR1cm4gXCIoJ1wiICsgYXJyYXkuam9pbihcIicsJ1wiKSArIFwiJylcIjtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzdW1PYmplY3RzKCkge1xuXHRcdFx0dmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cdFx0XHR2YXIgc3VtID0ge307XG5cblx0XHRcdHJldHVybiBhcmdzLnJlZHVjZShmdW5jdGlvbih0b3RhbCwgbmV4dCkge1xuXG5cdFx0XHRcdE9iamVjdC5rZXlzKG5leHQpXG5cdFx0XHRcdC5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdGlmKHR5cGVvZiBuZXh0W2tleV0gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHR0b3RhbFtrZXldID0gdG90YWxba2V5XSA/IHRvdGFsW2tleV0gKyBuZXh0W2tleV0gOiBuZXh0W2tleV07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvdGFsW2tleV0gPSBuZXh0W2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gdG90YWw7XG5cblx0XHRcdH0sIHN1bSk7XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmZjcicpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2ZjcicsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnZmNyL2Zjci5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdGY3JDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ2ZjclZtJ1xuXHRcdH0pO1xufV0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmNvbnRyb2xsZXIoJ0xheW91dENvbnRyb2xsZXInLCBMYXlvdXRDb250cm9sbGVyKTtcblxuXHRMYXlvdXRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnXTtcblxuXHRmdW5jdGlvbiBMYXlvdXRDb250cm9sbGVyKCRyb290U2NvcGUpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHRcblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnYXBpU2VydmljZScsIGFwaVNlcnZpY2UpO1xuXG4gICAgYXBpU2VydmljZS4kaW5qZWN0ID0gWyckaHR0cCcsICdhcHBDb25maWcnLCAnZXJyb3JTZXJ2aWNlJywgJ2RlYnVnU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gYXBpU2VydmljZSgkaHR0cCwgYXBwQ29uZmlnLCBlcnJvclNlcnZpY2UsIGRlYnVnKXtcblxuICAgICAgICB2YXIgYmFzZVVybCA9IGFwcENvbmZpZy5zZXJ2ZXI7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldERiU2V0dGluZ3M6IGdldERiU2V0dGluZ3MsXG4gICAgICAgICAgICBnZXRUYXNrczogZ2V0VGFza3MsXG4gICAgICAgICAgICBnZXRGQ1JTdGF0aXN0aWNzOiBnZXRGQ1JTdGF0aXN0aWNzLFxuICAgICAgICAgICAgZ2V0Q3VzdG9tRkNSU3RhdGlzdGljczogZ2V0Q3VzdG9tRkNSU3RhdGlzdGljcyxcbiAgICAgICAgICAgIGdldFRhc2tHcm91cFN0YXRpc3RpY3M6IGdldFRhc2tHcm91cFN0YXRpc3RpY3MsXG4gICAgICAgICAgICBnZXRDdXN0b21MaXN0U3RhdGlzdGljczogZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3MsXG4gICAgICAgICAgICBnZXRRdWVyeVJlc3VsdFNldDogZ2V0UXVlcnlSZXN1bHRTZXRcblxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldERiU2V0dGluZ3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc3RhdC9kYi5qc29uJyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrcyhwYXJhbXMsIGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFRhc2tzJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHBhcmFtc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KGJhc2VVcmwsIHJlcVBhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRGQ1JTdGF0aXN0aWNzKHBhcmFtcywgY2IpIHtcbiAgICAgICAgICAgIHZhciByZXFQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0RkNSU3RhdGlzdGljcycsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdChiYXNlVXJsLCByZXFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Q3VzdG9tRkNSU3RhdGlzdGljcyhwYXJhbXMsIGNiKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldEN1c3RvbUZDUlN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTsgICBcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRhc2tHcm91cFN0YXRpc3RpY3MocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFRhc2tHcm91cFN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRDdXN0b21MaXN0U3RhdGlzdGljcycsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdChiYXNlVXJsLCByZXFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0UXVlcnlSZXN1bHRTZXQocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgU0VMRUNUID0gJ1NFTEVDVCAnICsgcGFyYW1zLmNvbHVtbnM7XG4gICAgICAgICAgICB2YXIgRlJPTSA9ICdGUk9NICcgKyBwYXJhbXMudGFibGVzO1xuICAgICAgICAgICAgdmFyIFdIRVJFID0gKHBhcmFtcy50YWJyZWwgfHwgcGFyYW1zLmJlZ2luKSA/ICdXSEVSRSAnIDogJyc7XG4gICAgICAgICAgICB2YXIgR1JPVVBCWSA9IHBhcmFtcy5ncm91cEJ5ID8gKCdHUk9VUCBCWSAnICsgcGFyYW1zLmdyb3VwQnkpIDogJyc7XG5cbiAgICAgICAgICAgIFdIRVJFICs9IHBhcmFtcy50YWJyZWwgPyBwYXJhbXMudGFicmVsIDogJyc7XG4gICAgICAgICAgICBXSEVSRSArPSBwYXJhbXMuYmVnaW4gPyBcbiAgICAgICAgICAgICAgICAgICAgKCAoV0hFUkUgPyAnIGFuZCAnIDogJycpICsgJ3RpbWVzdGFydCBiZXR3ZWVuICcgKyBtb21lbnQocGFyYW1zLmJlZ2luKS51bml4KCkgKyAnIGFuZCAnICsgbW9tZW50KHBhcmFtcy5lbmQpLnVuaXgoKSApIDogJyc7XG5cbiAgICAgICAgICAgIHZhciByZXFQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0UXVlcnlSZXN1bHRTZXQnLFxuICAgICAgICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgICAgICAgICBxdWVyeTogW1NFTEVDVCwgRlJPTSwgV0hFUkUsIEdST1VQQlldLmpvaW4oJyAnKVxuICAgICAgICAgICAgICAgICAgICAvLyBxdWVyeTogWydTRUxFQ1QnLCBwYXJhbXMuY29sdW1ucywgJ0ZST00nLCBwYXJhbXMudGFibGVzLCAnV0hFUkUnLCAncHJvY2Vzc2VkLnByb2NpZD0nK3BhcmFtcy5wcm9jaWQsICdhbmQnLCBwYXJhbXMudGFicmVsLCAnYW5kIHRpbWVzdGFydCBiZXR3ZWVuJywgbW9tZW50KHBhcmFtcy5iZWdpbikudW5peCgpLCAnYW5kJywgbW9tZW50KHBhcmFtcy5lbmQpLnVuaXgoKSwgKHBhcmFtcy5ncm91cEJ5ID8gJ2dyb3VwIGJ5ICcrcGFyYW1zLmdyb3VwQnkgOiAnJyldLmpvaW4oJyAnKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdChiYXNlVXJsLCByZXFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdjaGFydFNlcnZpY2UnLCBjaGFydFNlcnZpY2UpO1xuXG4gICAgY2hhcnRTZXJ2aWNlLiRpbmplY3QgPSBbJ3V0aWxzU2VydmljZScsICdjb2xvdXJHZW5lcmF0b3InLCAnc3RvcmUnXTtcblxuICAgIGZ1bmN0aW9uIGNoYXJ0U2VydmljZSh1dGlsc1NlcnZpY2UsIGNvbG91ckdlbmVyYXRvciwgc3RvcmUpe1xuXG4gICAgICAgIHZhciB1c2VkQ29sb3VycyA9IHN0b3JlLmdldCgnY29sb3VycycpIHx8IFtdO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXRDaGFydERhdGE6IHNldENoYXJ0RGF0YSxcbiAgICAgICAgICAgIGdldENoYXJ0Q29sb3VyOiBnZXRDaGFydENvbG91clxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHNldENoYXJ0RGF0YShhcnJheSwgZGF0YWtleSwgbGFiZWxrZXksIG9yZGVyQnkpe1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBbXSwgbGFiZWxzID0gW10sIGNvbG91cnMgPSBbXTtcblxuICAgICAgICAgICAgaWYob3JkZXJCeSkgXG4gICAgICAgICAgICAgICAgYXJyYXkgPSB1dGlsc1NlcnZpY2Uuc29ydE9iakJ5KGFycmF5LCBvcmRlckJ5LCAnZGVzY2VuZCcpO1xuXG4gICAgICAgICAgICBhcnJheVxuICAgICAgICAgICAgLm1hcChmdW5jdGlvbihpdGVtKXtcbiAgICAgICAgICAgICAgICBkYXRhLnB1c2goYW5ndWxhci5pc051bWJlcihpdGVtW2RhdGFrZXldKSA/IHBhcnNlRmxvYXQoaXRlbVtkYXRha2V5XS50b0ZpeGVkKDIpKSA6IGl0ZW1bZGF0YWtleV0gKTtcbiAgICAgICAgICAgICAgICBsYWJlbHMucHVzaChpdGVtW2xhYmVsa2V5XSk7XG4gICAgICAgICAgICAgICAgY29sb3Vycy5wdXNoKGdldENoYXJ0Q29sb3VyKGl0ZW1bbGFiZWxrZXldKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICAgICAgbGFiZWxzOiBsYWJlbHMsXG4gICAgICAgICAgICAgICAgY29sb3VyczogY29sb3Vyc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldENoYXJ0Q29sb3VyKGNhdCl7XG4gICAgICAgICAgICB2YXIgZm91bmQgPSBmYWxzZSwgY29sb3VyID0gJyc7XG5cbiAgICAgICAgICAgIHVzZWRDb2xvdXJzLmZvckVhY2goZnVuY3Rpb24oaXRlbSl7XG4gICAgICAgICAgICAgICAgaWYoaXRlbS5uYW1lID09PSBjYXQpIGZvdW5kID0gaXRlbTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZihmb3VuZCkge1xuICAgICAgICAgICAgICAgIGNvbG91ciA9IGZvdW5kLmNvbG91cjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29sb3VyID0gY29sb3VyR2VuZXJhdG9yLmdldENvbG9yKCk7XG4gICAgICAgICAgICAgICAgdXNlZENvbG91cnMucHVzaCh7IG5hbWU6IGNhdCwgY29sb3VyOiBjb2xvdXIgfSk7XG4gICAgICAgICAgICAgICAgc3RvcmUuc2V0KCdjb2xvdXJzJywgdXNlZENvbG91cnMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY29sb3VyO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdjb2xvdXJHZW5lcmF0b3InLCBjb2xvdXJHZW5lcmF0b3IpO1xuXG4gICAgZnVuY3Rpb24gY29sb3VyR2VuZXJhdG9yKCl7XG5cbiAgICAgICAgLy8gaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvcmFuZG9tLW1hdGVyaWFsLWNvbG9yXG5cbiAgICAgICAgdmFyIGRlZmF1bHRQYWxldHRlID0ge1xuICAgICAgICAgICAgLy8gUmVkLCBQaW5rLCBQdXJwbGUsIERlZXAgUHVycGxlLCBJbmRpZ28sIEJsdWUsIExpZ2h0IEJsdWUsIEN5YW4sIFRlYWwsIEdyZWVuLCBMaWdodCBHcmVlbiwgTGltZSwgWWVsbG93LCBBbWJlciwgT3JhbmdlLCBEZWVwIE9yYW5nZSwgQnJvd24sIEdyZXksIEJsdWUgR3JleVxuICAgICAgICAgICAgJzUwJzogWycjRkZFQkVFJywgJyNGQ0U0RUMnLCAnI0YzRTVGNScsICcjRURFN0Y2JywgJyNFOEVBRjYnLCAnI0UzRjJGRCcsICcjRTFGNUZFJywgJyNFMEY3RkEnLCAnI0UwRjJGMScsICcjRThGNUU5JywgJyNGMUY4RTknLCAnI0Y5RkJFNycsICcjRkZGREU3JywgJyNGRkY4RTEnLCAnI0ZGRjNFMCcsICcjRkJFOUU3JywgJyNFRkVCRTknLCAnI0ZBRkFGQScsICcjRUNFRkYxJ10sXG4gICAgICAgICAgICAnMTAwJzogWycjRkZDREQyJywgJyNGOEJCRDAnLCAnI0UxQkVFNycsICcjRDFDNEU5JywgJyNDNUNBRTknLCAnI0JCREVGQicsICcjQjNFNUZDJywgJyNCMkVCRjInLCAnI0IyREZEQicsICcjQzhFNkM5JywgJyNEQ0VEQzgnLCAnI0YwRjRDMycsICcjRkZGOUM0JywgJyNGRkVDQjMnLCAnI0ZGRTBCMicsICcjRkZDQ0JDJywgJyNEN0NDQzgnLCAnI0Y1RjVGNScsICcjQ0ZEOERDJ10sXG4gICAgICAgICAgICAnMjAwJzogWycjRUY5QTlBJywgJyNGNDhGQjEnLCAnI0NFOTNEOCcsICcjQjM5RERCJywgJyM5RkE4REEnLCAnIzkwQ0FGOScsICcjODFENEZBJywgJyM4MERFRUEnLCAnIzgwQ0JDNCcsICcjQTVENkE3JywgJyNDNUUxQTUnLCAnI0U2RUU5QycsICcjRkZGNTlEJywgJyNGRkUwODInLCAnI0ZGQ0M4MCcsICcjRkZBQjkxJywgJyNCQ0FBQTQnLCAnI0VFRUVFRScsICcjQjBCRUM1J10sXG4gICAgICAgICAgICAnMzAwJzogWycjRTU3MzczJywgJyNGMDYyOTInLCAnI0JBNjhDOCcsICcjOTU3NUNEJywgJyM3OTg2Q0InLCAnIzY0QjVGNicsICcjNEZDM0Y3JywgJyM0REQwRTEnLCAnIzREQjZBQycsICcjODFDNzg0JywgJyNBRUQ1ODEnLCAnI0RDRTc3NScsICcjRkZGMTc2JywgJyNGRkQ1NEYnLCAnI0ZGQjc0RCcsICcjRkY4QTY1JywgJyNBMTg4N0YnLCAnI0UwRTBFMCcsICcjOTBBNEFFJ10sXG4gICAgICAgICAgICAnNDAwJzogWycjRUY1MzUwJywgJyNFQzQwN0EnLCAnI0FCNDdCQycsICcjN0U1N0MyJywgJyM1QzZCQzAnLCAnIzQyQTVGNScsICcjMjlCNkY2JywgJyMyNkM2REEnLCAnIzI2QTY5QScsICcjNjZCQjZBJywgJyM5Q0NDNjUnLCAnI0Q0RTE1NycsICcjRkZFRTU4JywgJyNGRkNBMjgnLCAnI0ZGQTcyNicsICcjRkY3MDQzJywgJyM4RDZFNjMnLCAnI0JEQkRCRCcsICcjNzg5MDlDJ10sXG4gICAgICAgICAgICAnNTAwJzogWycjRjQ0MzM2JywgJyNFOTFFNjMnLCAnIzlDMjdCMCcsICcjNjczQUI3JywgJyMzRjUxQjUnLCAnIzIxOTZGMycsICcjMDNBOUY0JywgJyMwMEJDRDQnLCAnIzAwOTY4OCcsICcjNENBRjUwJywgJyM4QkMzNEEnLCAnI0NEREMzOScsICcjRkZFQjNCJywgJyNGRkMxMDcnLCAnI0ZGOTgwMCcsICcjRkY1NzIyJywgJyM3OTU1NDgnLCAnIzlFOUU5RScsICcjNjA3RDhCJ10sXG4gICAgICAgICAgICAnNjAwJzogWycjRTUzOTM1JywgJyNEODFCNjAnLCAnIzhFMjRBQScsICcjNUUzNUIxJywgJyMzOTQ5QUInLCAnIzFFODhFNScsICcjMDM5QkU1JywgJyMwMEFDQzEnLCAnIzAwODk3QicsICcjNDNBMDQ3JywgJyM3Q0IzNDInLCAnI0MwQ0EzMycsICcjRkREODM1JywgJyNGRkIzMDAnLCAnI0ZCOEMwMCcsICcjRjQ1MTFFJywgJyM2RDRDNDEnLCAnIzc1NzU3NScsICcjNTQ2RTdBJ10sXG4gICAgICAgICAgICAnNzAwJzogWycjRDMyRjJGJywgJyNDMjE4NUInLCAnIzdCMUZBMicsICcjNTEyREE4JywgJyMzMDNGOUYnLCAnIzE5NzZEMicsICcjMDI4OEQxJywgJyMwMDk3QTcnLCAnIzAwNzk2QicsICcjMzg4RTNDJywgJyM2ODlGMzgnLCAnI0FGQjQyQicsICcjRkJDMDJEJywgJyNGRkEwMDAnLCAnI0Y1N0MwMCcsICcjRTY0QTE5JywgJyM1RDQwMzcnLCAnIzYxNjE2MScsICcjNDU1QTY0J10sXG4gICAgICAgICAgICAnODAwJzogWycjQzYyODI4JywgJyNBRDE0NTcnLCAnIzZBMUI5QScsICcjNDUyN0EwJywgJyMyODM1OTMnLCAnIzE1NjVDMCcsICcjMDI3N0JEJywgJyMwMDgzOEYnLCAnIzAwNjk1QycsICcjMkU3RDMyJywgJyM1NThCMkYnLCAnIzlFOUQyNCcsICcjRjlBODI1JywgJyNGRjhGMDAnLCAnI0VGNkMwMCcsICcjRDg0MzE1JywgJyM0RTM0MkUnLCAnIzQyNDI0MicsICcjMzc0NzRGJ10sXG4gICAgICAgICAgICAnOTAwJzogWycjQjcxQzFDJywgJyM4ODBFNEYnLCAnIzRBMTQ4QycsICcjMzExQjkyJywgJyMxQTIzN0UnLCAnIzBENDdBMScsICcjMDE1NzlCJywgJyMwMDYwNjQnLCAnIzAwNEQ0MCcsICcjMUI1RTIwJywgJyMzMzY5MUUnLCAnIzgyNzcxNycsICcjRjU3RjE3JywgJyNGRjZGMDAnLCAnI0U2NTEwMCcsICcjQkYzNjBDJywgJyMzRTI3MjMnLCAnIzIxMjEyMScsICcjMjYzMjM4J10sXG4gICAgICAgICAgICAnQTEwMCc6IFsnI0ZGOEE4MCcsICcjRkY4MEFCJywgJyNFQTgwRkMnLCAnI0IzODhGRicsICcjOEM5RUZGJywgJyM4MkIxRkYnLCAnIzgwRDhGRicsICcjODRGRkZGJywgJyNBN0ZGRUInLCAnI0I5RjZDQScsICcjQ0NGRjkwJywgJyNGNEZGODEnLCAnI0ZGRkY4RCcsICcjRkZFNTdGJywgJyNGRkQxODAnLCAnI0ZGOUU4MCddLFxuICAgICAgICAgICAgJ0EyMDAnOiBbJyNGRjUyNTInLCAnI0ZGNDA4MScsICcjRTA0MEZCJywgJyM3QzRERkYnLCAnIzUzNkRGRScsICcjNDQ4QUZGJywgJyM0MEM0RkYnLCAnIzE4RkZGRicsICcjNjRGRkRBJywgJyM2OUYwQUUnLCAnI0IyRkY1OScsICcjRUVGRjQxJywgJyNGRkZGMDAnLCAnI0ZGRDc0MCcsICcjRkZBQjQwJywgJyNGRjZFNDAnXSxcbiAgICAgICAgICAgICdBNDAwJzogWycjRkYxNzQ0JywgJyNGNTAwNTcnLCAnI0Q1MDBGOScsICcjNjUxRkZGJywgJyMzRDVBRkUnLCAnIzI5NzlGRicsICcjMDBCMEZGJywgJyMwMEU1RkYnLCAnIzFERTlCNicsICcjMDBFNjc2JywgJyM3NkZGMDMnLCAnI0M2RkYwMCcsICcjRkZFQTAwJywgJyNGRkM0MDAnLCAnI0ZGOTEwMCcsICcjRkYzRDAwJ10sXG4gICAgICAgICAgICAnQTcwMCc6IFsnI0Q1MDAwMCcsICcjQzUxMTYyJywgJyNBQTAwRkYnLCAnIzYyMDBFQScsICcjMzA0RkZFJywgJyMyOTYyRkYnLCAnIzAwOTFFQScsICcjMDBCOEQ0JywgJyMwMEJGQTUnLCAnIzAwQzg1MycsICcjNjRERDE3JywgJyNBRUVBMDAnLCAnI0ZGRDYwMCcsICcjRkZBQjAwJywgJyNGRjZEMDAnLCAnI0REMkMwMCddXG4gICAgICAgIH07XG5cbiAgICAgICAgLyogdXNlZENvbG9ycyA9IFt7IHRleHQ6U29tZVRleHQsIGNvbG9yOiBTb21lQ29sb3IgfV0gKi9cbiAgICAgICAgdmFyIHVzZWRDb2xvcnMgPSBbXTtcbiAgICAgICAgdmFyIGRlZmF1bHRPcHRpb25zID0ge1xuICAgICAgICAgICAgc2hhZGVzOiBbJzUwJywgJzEwMCcsICcyMDAnLCAnMzAwJywgJzQwMCcsICc1MDAnLCAnNjAwJywgJzcwMCcsICc4MDAnLCAnOTAwJywgJ0ExMDAnLCAnQTIwMCcsICdBNDAwJywgJ0E3MDAnXSxcbiAgICAgICAgICAgIHBhbGV0dGU6IGRlZmF1bHRQYWxldHRlLFxuICAgICAgICAgICAgdGV4dDogbnVsbCxcbiAgICAgICAgICAgIGlnbm9yZUNvbG9yczogW11cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0Q29sb3I6IGdldENvbG9yXG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0Q29sb3Iob3B0aW9ucykge1xuICAgICAgICAgICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zKTtcbiAgICAgICAgICAgIG9wdGlvbnMucGFsZXR0ZSB8fCAob3B0aW9ucy5wYWxldHRlID0gZGVmYXVsdFBhbGV0dGUpO1xuICAgICAgICAgICAgb3B0aW9ucy5zaGFkZXMgfHwgKG9wdGlvbnMuc2hhZGVzID0gWyc1MDAnXSk7XG5cbiAgICAgICAgICAgIHZhciBsID0gdXNlZENvbG9ycy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgY29sb3I7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMudGV4dCAmJiB1c2VkQ29sb3JzW2ldLnRleHQgPT09IG9wdGlvbnMudGV4dCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdXNlZENvbG9yc1tpXS5jb2xvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbG9yID0gcGlja0NvbG9yKG9wdGlvbnMpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAob3B0aW9ucy50ZXh0KSB7XG4gICAgICAgICAgICAgICAgdXNlZENvbG9ycy5wdXNoKHt0ZXh0OiBvcHRpb25zLnRleHQsIGNvbG9yOiBjb2xvcn0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29sb3I7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwaWNrQ29sb3Iob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIHNoYWRlID0gb3B0aW9ucy5zaGFkZXNbZ2V0UmFuZG9tSW50KG9wdGlvbnMuc2hhZGVzLmxlbmd0aCldO1xuICAgICAgICAgICAgdmFyIGNvbG9yID0gJyc7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBvcHRpb25zLnBhbGV0dGUpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5wYWxldHRlLmhhc093blByb3BlcnR5KGtleSkgJiYga2V5ID09PSBzaGFkZSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xvciA9IG9wdGlvbnMucGFsZXR0ZVtrZXldW2dldFJhbmRvbUludChvcHRpb25zLnBhbGV0dGVba2V5XS5sZW5ndGgpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjb2xvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFJhbmRvbUludChtYXgpIHtcbiAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4KSk7XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2RlYnVnU2VydmljZScsIGRlYnVnU2VydmljZSk7XG5cbiAgICBkZWJ1Z1NlcnZpY2UuJGluamVjdCA9IFsnJGxvZycsICdzdG9yZScsICdlcnJvclNlcnZpY2UnXTtcblxuICAgIGZ1bmN0aW9uIGRlYnVnU2VydmljZSgkbG9nLCBzdG9yZSwgZXJyb3JTZXJ2aWNlKXtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9nOiBmdW5jdGlvbihtZXNzYWdlKXsgbG9nKGFyZ3VtZW50cywgJ2xvZycpOyB9LFxuICAgICAgICAgICAgaW5mbzogZnVuY3Rpb24obWVzc2FnZSl7IGxvZyhhcmd1bWVudHMsICdpbmZvJyk7IH0sXG4gICAgICAgICAgICB3YXJuOiBmdW5jdGlvbihtZXNzYWdlKXsgbG9nKGFyZ3VtZW50cywgJ3dhcm4nKTsgfSxcbiAgICAgICAgICAgIGVycm9yOiBlcnJvclNlcnZpY2Uuc2hvd1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGxvZyhhcmdzLCBtZXRob2Qpe1xuICAgICAgICAgICAgaWYoc3RvcmUuZ2V0KCdkZWJ1ZycpKSB7XG4gICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKGFyZ3MsIGZ1bmN0aW9uKGFyZyl7XG4gICAgICAgICAgICAgICAgICAgICRsb2dbbWV0aG9kXShhcmcpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnZXJyb3JTZXJ2aWNlJywgZXJyb3JTZXJ2aWNlKTtcblxuICAgIGVycm9yU2VydmljZS4kaW5qZWN0ID0gW107XG5cbiAgICBmdW5jdGlvbiBlcnJvclNlcnZpY2UoKXtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2hvdzogc2hvd1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHNob3coZXJyb3Ipe1xuICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgLy8gJHRyYW5zbGF0ZSgnRVJST1JTLicrZXJyb3IpXG4gICAgICAgICAgICAvLyAudGhlbihmdW5jdGlvbiAodHJhbnNsYXRpb24pe1xuICAgICAgICAgICAgLy8gICAgIGlmKCdFUlJPUlMuJytlcnJvciA9PT0gdHJhbnNsYXRpb24pIHtcbiAgICAgICAgICAgIC8vICAgICAgICAgbm90aWZpY2F0aW9ucy5zaG93RXJyb3IoJ0VSUk9SX09DQ1VSUkVEJyk7XG4gICAgICAgICAgICAvLyAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vICAgICAgICAgbm90aWZpY2F0aW9ucy5zaG93RXJyb3IodHJhbnNsYXRpb24pO1xuICAgICAgICAgICAgLy8gICAgIH1cbiAgICAgICAgICAgIC8vIH0pO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdTZXR0aW5nc1NlcnZpY2UnLCBTZXR0aW5nc1NlcnZpY2UpO1xuXG4gICAgU2V0dGluZ3NTZXJ2aWNlLiRpbmplY3QgPSBbJyRxJywgJ2FwaVNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBTZXR0aW5nc1NlcnZpY2UoJHEsIGFwaSwgZXJyb3JTZXJ2aWNlKXtcblxuICAgICAgICB2YXIgc2V0dGluZ3MgPSBudWxsO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXRTZXR0aW5nczogZ2V0U2V0dGluZ3NcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdldCBEQiBzZXR0aW5ncyBmcm9tIGNhY2hlIG9yIEpTT04gZmlsZVxuICAgICAgICBmdW5jdGlvbiBnZXRTZXR0aW5ncygpIHtcbiAgICAgICAgICAgIHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgICAgICBpZihzZXR0aW5ncykge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHNldHRpbmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGFwaS5nZXREYlNldHRpbmdzKClcbiAgICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcbiAgICAgICAgICAgICAgICAgICAgc2V0dGluZ3MgPSBkYlNldHRpbmdzLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ1Rhc2tzU2VydmljZScsIFRhc2tzU2VydmljZSk7XG5cbiAgICBUYXNrc1NlcnZpY2UuJGluamVjdCA9IFsnYXBpU2VydmljZScsICdlcnJvclNlcnZpY2UnXTtcblxuICAgIGZ1bmN0aW9uIFRhc2tzU2VydmljZShhcGksIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgdmFyIHRhc2tzID0gW1xuICAgICAgICAgICAge25hbWU6ICdJbmNvbWluZ19BZ2VudCcsIGtpbmQ6IDF9LFxuICAgICAgICAgICAge25hbWU6ICdNZXNzYWdpbmdfQ2hhdCcsIGtpbmQ6IDd9LFxuICAgICAgICAgICAge25hbWU6ICdBdXRvZGlhbF9BZ2VudCcsIGtpbmQ6IDEyOX1cbiAgICAgICAgXTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0VGFza3M6IGdldFRhc2tzLFxuICAgICAgICAgICAgZ2V0VGFza0xpc3Q6IGdldFRhc2tMaXN0XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrcygpIHtcbiAgICAgICAgICAgIHJldHVybiB0YXNrcztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRhc2tMaXN0KGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gYXBpLmdldFRhc2tzKHsga2luZDogaWQgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCd1dGlsc1NlcnZpY2UnLCB1dGlsc1NlcnZpY2UpO1xuXG4gICAgLy8gdXRpbHNTZXJ2aWNlLiRpbmplY3QgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHV0aWxzU2VydmljZSgpe1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXRUb3RhbHM6IGdldFRvdGFscyxcbiAgICAgICAgICAgIHNldFBlcmNlbnRhZ2VWYWx1ZXM6IHNldFBlcmNlbnRhZ2VWYWx1ZXMsXG4gICAgICAgICAgICBnZXRBYmFuZG9ubWVudFJhdGU6IGdldEFiYW5kb25tZW50UmF0ZSxcbiAgICAgICAgICAgIGdldFNsSW5kZXg6IGdldFNsSW5kZXgsXG4gICAgICAgICAgICBnZXRGcmllbmRseUtpbmQ6IGdldEZyaWVuZGx5S2luZCxcbiAgICAgICAgICAgIGV4dGVuZEFuZFN1bTogZXh0ZW5kQW5kU3VtLFxuICAgICAgICAgICAgc29ydE9iakJ5OiBzb3J0T2JqQnksXG4gICAgICAgICAgICBxdWVyeVRvT2JqZWN0OiBxdWVyeVRvT2JqZWN0LFxuICAgICAgICAgICAgcGVyaW9kVG9SYW5nZTogcGVyaW9kVG9SYW5nZSxcbiAgICAgICAgICAgIGZpbHRlckJ5S2V5OiBmaWx0ZXJCeUtleSxcbiAgICAgICAgICAgIGZpbHRlclVuaXF1ZTogZmlsdGVyVW5pcXVlXG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0VG90YWxzKHByZXYsIG5leHQpe1xuICAgICAgICAgICAgdmFyIHRvdGFscyA9IHt9O1xuICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gcHJldil7XG4gICAgICAgICAgICAgICAgaWYoIWlzTmFOKHBhcnNlRmxvYXQocHJldltrZXldKSkgJiYgIWlzTmFOKHBhcnNlRmxvYXQobmV4dFtrZXldKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWxzW2tleV0gPSBwYXJzZUZsb2F0KHByZXZba2V5XSkgKyBwYXJzZUZsb2F0KG5leHRba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRvdGFscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNldFBlcmNlbnRhZ2VWYWx1ZXMoZGF0YSwgdG90YWxzKXtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gaXRlbSl7XG4gICAgICAgICAgICAgICAgICAgIGlmKHRvdGFscy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtW2tleSsnX3AnXSA9IChpdGVtW2tleV0gLyB0b3RhbHNba2V5XSAqIDEwMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEFiYW5kb25tZW50UmF0ZShuY28sIG5jYSl7XG4gICAgICAgICAgICByZXR1cm4gbmNhICogMTAwIC8gbmNvO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0U2xJbmRleChhcnJheSl7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSAtMTtcbiAgICAgICAgICAgIGFycmF5LmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaSkge1xuICAgICAgICAgICAgICAgIGlmKC9ec2wvLnRlc3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RnJpZW5kbHlLaW5kKGtpbmQpe1xuICAgICAgICAgICAgdmFyIGZraW5kID0gJyc7XG4gICAgICAgICAgICBzd2l0Y2ggKGtpbmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgIGZraW5kID0gJ0luY29taW5nX0FnZW50JztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgICAgICAgICBma2luZCA9ICdNZXNzYWdpbmdfQ2hhdCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgMTI5OlxuICAgICAgICAgICAgICAgICAgICBma2luZCA9ICdBdXRvZGlhbF9BZ2VudCc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZraW5kID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZraW5kO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXh0ZW5kQW5kU3VtKG9iajEsIG9iajIsIGluZGV4LCBhcnJheSl7XG4gICAgICAgICAgICB2YXIga2V5LCB2YWwxLCB2YWwyO1xuICAgICAgICAgICAgZm9yKCBrZXkgaW4gb2JqMiApIHtcbiAgICAgICAgICAgICAgICBpZiggb2JqMi5oYXNPd25Qcm9wZXJ0eSgga2V5ICkgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbDEgPSBhbmd1bGFyLmlzVW5kZWZpbmVkKG9iajFba2V5XSkgPyAwIDogb2JqMVtrZXldO1xuICAgICAgICAgICAgICAgICAgICB2YWwyID0gYW5ndWxhci5pc1VuZGVmaW5lZChvYmoyW2tleV0pID8gMCA6IHBhcnNlRmxvYXQob2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYoIWlzTmFOKHZhbDIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb3VudCBzdW0gYW5kIGZpbmQgYXZlcmFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldID0gYW5ndWxhci5pc051bWJlcih2YWwxKSA/ICh2YWwxICsgdmFsMikgOiAocGFyc2VGbG9hdCh2YWwxKSArIHZhbDIpLnRvRml4ZWQoMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZihpbmRleCA9PT0gYXJyYXkubGVuZ3RoLTEpIG9iajFba2V5XSA9IG9iajFba2V5XSAvIGFycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGFuZ3VsYXIuaXNBcnJheShvYmoxW2tleV0pKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBwdXNoIHRvIHRoZSBhcnJheSBvZiBzdHJpbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldLnB1c2gob2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgbmV3IGFycmF5IGFuZCBhZGQgdmFsdWVzIHRvIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2JqMVtrZXldID0gW10uY29uY2F0KG9iajFba2V5XSwgb2JqMltrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmoxO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc29ydE9iakJ5KGFycmF5LCBrZXksIGRlc2NlbmQpe1xuICAgICAgICAgICAgdmFyIHNvcnRlZCA9IGFycmF5LnNvcnQoZnVuY3Rpb24oYSwgYil7XG4gICAgICAgICAgICAgICAgaWYoYVtrZXldID4gYltrZXldKSByZXR1cm4gZGVzY2VuZCA/IC0xIDogMTtcbiAgICAgICAgICAgICAgICBpZihhW2tleV0gPCBiW2tleV0pIHJldHVybiBkZXNjZW5kID8gMSA6IC0xO1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc29ydGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcXVlcnlUb09iamVjdChkYXRhLCBrZXlzKXtcbiAgICAgICAgICAgIHZhciBvYmosIGtleTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLm1hcChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAgICAgb2JqID0ge307XG4gICAgICAgICAgICAgICAgaXRlbS5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgb2JqW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBwZXJpb2RUb1JhbmdlKHBlcmlvZCl7XG4gICAgICAgICAgICB2YXIgYXJyID0gcGVyaW9kLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGJlZ2luOiBtb21lbnQoKS5zdGFydE9mKGFyclsxXSkudG9EYXRlKCksXG4gICAgICAgICAgICAgICAgZW5kOiBtb21lbnQoKS5lbmRPZihhcnJbMV0pLnRvRGF0ZSgpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gcmV0dXJuIHtcbiAgICAgICAgICAgIC8vICAgICBiZWdpbjogbW9tZW50KCkuc3VidHJhY3QocGFyc2VJbnQoYXJyWzBdLCAxMCksIGFyclsxXSkudG9EYXRlKCksXG4gICAgICAgICAgICAvLyAgICAgZW5kOiBtb21lbnQoKS5lbmRPZignZGF5JykudG9EYXRlKClcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGZpbHRlckJ5S2V5KG9iamVjdCwga2V5KXtcbiAgICAgICAgICAgIHJldHVybiBvYmplY3Rba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGZpbHRlclVuaXF1ZShpdGVtLCBpbmRleCwgYXJyYXkpe1xuICAgICAgICAgICAgaWYoYXJyYXkuaW5kZXhPZihpdGVtKSA9PT0gLTEpIHJldHVybiBpdGVtO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcCcpXG4uZmlsdGVyKCdjb252ZXJ0Qnl0ZXMnLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGludGVnZXIsIGZyb21Vbml0cywgdG9Vbml0cykge1xuICAgIHZhciBjb2VmZmljaWVudHMgPSB7XG4gICAgICAgICdCeXRlJzogMSxcbiAgICAgICAgJ0tCJzogMTAwMCxcbiAgICAgICAgJ01CJzogMTAwMDAwMCxcbiAgICAgICAgJ0dCJzogMTAwMDAwMDAwMFxuICAgIH07XG4gICAgcmV0dXJuIGludGVnZXIgKiBjb2VmZmljaWVudHNbZnJvbVVuaXRzXSAvIGNvZWZmaWNpZW50c1t0b1VuaXRzXTtcbiAgfTtcbn0pXG4uZmlsdGVyKCd0c1RvRGF0ZScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24odHMpIHtcblx0XHRpZighdHMpIHJldHVybjtcblx0XHR2YXIgZGF0ZSA9IG5ldyBEYXRlKHRzKjEwMDApLnRvTG9jYWxlU3RyaW5nKCk7XG5cdFx0Y29uc29sZS5sb2coJ3RzVG9EYXRlOiAnLCBkYXRlKTtcblx0XHRyZXR1cm4gZGF0ZTtcblx0fTtcbn0pXG4uZmlsdGVyKCdhdmVyYWdlJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgbnVtYmVyKSB7XG5cdFx0aWYodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXHRcdFxuXHRcdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKSAvIChudW1iZXIgfHwgMSk7XG5cdH07XG59KVxuLmZpbHRlcigndGltZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBmcmFjdGlvbikge1xuXHRcdGlmKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblx0XHRcblx0XHR2YXIgZmlsdGVyZWQgPSBwYXJzZUZsb2F0KHZhbHVlKSxcblx0XHRcdGhoID0gMCwgbW0gPSAwLCBzcyA9IDA7XG5cblx0XHRmdW5jdGlvbiBwcmVwYXJlKG51bWJlcil7XG5cdFx0XHRyZXR1cm4gTWF0aC5mbG9vcihudW1iZXIpID4gOSA/IE1hdGguZmxvb3IobnVtYmVyKSA6ICcwJytNYXRoLmZsb29yKG51bWJlcik7XG5cdFx0fVxuXG5cdFx0aGggPSBmaWx0ZXJlZCAvIDM2MDA7XG5cdFx0bW0gPSAoZmlsdGVyZWQgJSAzNjAwKSAvIDYwO1xuXHRcdHNzID0gKG1tICUgMSkvMTAwKjYwKjEwMDtcblxuXHRcdHJldHVybiBwcmVwYXJlKGhoKSsnOicrcHJlcGFyZShtbSkrJzonK3ByZXBhcmUoc3MpO1xuXHR9O1xufSlcbi5maWx0ZXIoJ2R1cmF0aW9uJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgZnJhY3Rpb24pIHtcblx0XHRpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cdFx0XG5cdFx0dmFyIGZpbHRlcmVkID0gcGFyc2VGbG9hdCh2YWx1ZSksXG5cdFx0XHRwcmVmaXggPSAncyc7XG5cblx0XHRpZihmaWx0ZXJlZCA+IDM2MDApIHtcblx0XHRcdGZpbHRlcmVkID0gZmlsdGVyZWQgLyAzNjAwO1xuXHRcdFx0cHJlZml4ID0gJ2gnO1xuXHRcdH0gZWxzZSBpZihmaWx0ZXJlZCA+IDYwKSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkIC8gNjA7XG5cdFx0XHRwcmVmaXggPSAnbSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZpbHRlcmVkID0gZmlsdGVyZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXJlZC50b0ZpeGVkKGZyYWN0aW9uIHx8IDIpICsgJyAnICsgcHJlZml4O1xuXHR9O1xufSlcbi5maWx0ZXIoJ2RpZmYnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHByZXZ2YWx1ZSwgbmV4dHZhbHVlLCB1bml0KSB7XG5cdFx0aWYocHJldnZhbHVlID09PSB1bmRlZmluZWQgJiYgbmV4dHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuXHRcdHZhciBpbnRQcmV2VmFsdWUgPSBwcmV2dmFsdWUgPyBwYXJzZUZsb2F0KHByZXZ2YWx1ZSkgOiAwLFxuXHRcdFx0aW50TmV4dFZhbHVlID0gbmV4dHZhbHVlID8gcGFyc2VGbG9hdChuZXh0dmFsdWUpIDogMCxcblx0XHRcdGZpbHRlcmVkLCBkaWZmLCBwcmVmaXggPSAnKycsIGR5bmFtaWNzID0gdHJ1ZTtcblxuXHRcdGlmKGludFByZXZWYWx1ZSA+IGludE5leHRWYWx1ZSkge1xuXHRcdFx0ZGlmZiA9IGludFByZXZWYWx1ZSAtIGludE5leHRWYWx1ZTtcblx0XHRcdGZpbHRlcmVkID0gZGlmZiAqIDEwMCAvIGludFByZXZWYWx1ZTtcblx0XHRcdHByZWZpeCA9ICctJztcblx0XHRcdGR5bmFtaWNzID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpZmYgPSBpbnROZXh0VmFsdWUgLSBpbnRQcmV2VmFsdWU7XG5cdFx0XHRmaWx0ZXJlZCA9IGRpZmYgKiAxMDAgLyBpbnROZXh0VmFsdWU7XG5cdFx0fVxuXG5cdFx0aWYodW5pdCA9PT0gJ3ZhbHVlJykge1xuXHRcdFx0cmV0dXJuIHByZWZpeCtkaWZmO1xuXHRcdH0gZWxzZSBpZih1bml0ID09PSAnZHluYW1pY3MnKSB7XG5cdFx0XHRyZXR1cm4gZHluYW1pY3M7XG5cdFx0fSBlbHNlIGlmKHVuaXQgPT09ICdkeW5hbWljcy1yZXZlcnNlJykge1xuXHRcdFx0cmV0dXJuICFkeW5hbWljcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByZWZpeCtmaWx0ZXJlZC50b0ZpeGVkKDEpKyclJztcblx0XHR9XG5cdH07XG59KVxuLmZpbHRlcignZHluYW1pY3MnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHZhbHVlMSwgdmFsdWUyKSB7XG5cdFx0aWYodmFsdWUxID09PSB1bmRlZmluZWQgJiYgdmFsdWUyID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuXHRcdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlMSkgPiBwYXJzZUZsb2F0KHZhbHVlMikgPyAncG9zaXRpdmUnIDogJ25lZ2F0aXZlJztcblx0fTtcbn0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLnFvcycpXG5cdFx0LmNvbnRyb2xsZXIoJ1Fvc1NldHRpbmdzQ29udHJvbGxlcicsIFFvc1NldHRpbmdzQ29udHJvbGxlcik7XG5cblx0UW9zU2V0dGluZ3NDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckbWREaWFsb2cnLCAndGFza3MnLCAnc2VsZWN0ZWRUYXNrcycsICdkZWJ1Z1NlcnZpY2UnXTtcblxuXHRmdW5jdGlvbiBRb3NTZXR0aW5nc0NvbnRyb2xsZXIoJHNjb3BlLCAkbWREaWFsb2csIHRhc2tzLCBzZWxlY3RlZFRhc2tzLCBkZWJ1Zykge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHNlbGVjdGVkVGFza3MpO1xuXHRcdHZtLnNlbGVjdEFsbFRhc2tzID0gc2VsZWN0QWxsVGFza3M7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9ICh0YXNrcy5sZW5ndGggPT09IHNlbGVjdGVkVGFza3MubGVuZ3RoKTtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmluZGV4ID0gaW5kZXg7XG5cdFx0dm0uZXhpc3RzID0gZXhpc3RzO1xuXG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpe1xuXHRcdFx0cmV0dXJuIHZtLnNlbGVjdGVkVGFza3MubGVuZ3RoO1xuXHRcdH0sIGZ1bmN0aW9uKHZhbCl7XG5cdFx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gdm0uc2VsZWN0ZWRUYXNrcy5sZW5ndGggPT09IHZtLnRhc2tzLmxlbmd0aDtcblx0XHR9KTtcblxuXHRcdGRlYnVnLmxvZygndGFza3NtIHNlbGVjdGVkVGFza3M6ICcsIHZtLnRhc2tzLCB2bS5zZWxlY3RlZFRhc2tzKTtcblxuXHRcdGZ1bmN0aW9uIHNhdmUoKSB7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNlbGVjdGVkVGFza3M6IHZtLnNlbGVjdGVkVGFza3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNsb3NlU2V0dGluZ3MoKSB7XG5cdFx0XHQkbWREaWFsb2cuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0QWxsVGFza3MoKSB7XG5cdFx0XHRpZih2bS5hbGxUYXNrc1NlbGVjdGVkKSB2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHRcdGVsc2Ugdm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gaW5kZXgoaXRlbSwgbGlzdCk7XG5cdFx0XHRpZiAoaWR4ICE9PSAtMSkgbGlzdC5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdGVsc2UgbGlzdC5wdXNoKGl0ZW0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGluZGV4KGl0ZW0sIGxpc3QpIHtcblx0XHRcdHZhciBpZHggPSAtMTtcblx0XHRcdGxpc3QuZm9yRWFjaChmdW5jdGlvbihsaXN0SXRlbSwgaW5kZXgpe1xuXHRcdFx0XHRpZihsaXN0SXRlbSA9PSBpdGVtKSBpZHggPSBpbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGlkeDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleGlzdHMoaXRlbSwgbGlzdCkge1xuXHRcdFx0cmV0dXJuIGxpc3QuaW5kZXhPZihpdGVtKSA+IC0xO1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAucW9zJylcblx0XHQuY29udHJvbGxlcignUW9zQ29udHJvbGxlcicsIFFvc0NvbnRyb2xsZXIpO1xuXG5cdFFvc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckbWREaWFsb2cnLCAnU2V0dGluZ3NTZXJ2aWNlJywgJ2FwaVNlcnZpY2UnLCAnc3RvcmUnLCAnVGFza3NTZXJ2aWNlJywgJ3V0aWxzU2VydmljZScsICdkZWJ1Z1NlcnZpY2UnLCAnc3Bpbm5lclNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gUW9zQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkbWREaWFsb2csIFNldHRpbmdzU2VydmljZSwgYXBpLCBzdG9yZSwgVGFza3NTZXJ2aWNlLCB1dGlscywgZGVidWcsIHNwaW5uZXJTZXJ2aWNlLCBlcnJvclNlcnZpY2UpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHRPcHRpb25zID0ge1xuXHRcdFx0cGVyaW9kOiAnMSBkYXknXG5cdFx0fTtcblx0XHR2YXIgcGVyZlN0YXQgPSBbXTtcblx0XHR2YXIgYWdlbnRTdGF0ID0gW107XG5cdFx0dmFyIGFnZW50c0ZjciA9IHt9O1xuXHRcdFxuXHRcdHZtLnNldHRpbmdzID0ge307XG5cdFx0dm0udGFza3MgPSBbXTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW107XG5cdFx0dm0uc3RhdCA9IFtdO1xuXHRcdHZtLnN0YXRBdmcgPSBbXTtcblx0XHR2bS50b3RhbEF2ZyA9IHt9O1xuXHRcdHZtLmNvbHVtbnMgPSB7fTtcblx0XHR2bS5xbnVtID0gW107XG5cdFx0dm0uYmVnaW4gPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRPcHRpb25zLnBlcmlvZCkuYmVnaW47XG5cdFx0dm0uZW5kID0gdXRpbHMucGVyaW9kVG9SYW5nZShkZWZhdWx0T3B0aW9ucy5wZXJpb2QpLmVuZDtcblx0XHR2bS5nZXRTdGF0ID0gZ2V0U3RhdDtcblx0XHR2bS5nZXRBdmdTdGF0ID0gZ2V0QXZnU3RhdDtcblx0XHR2bS5vcGVuU2V0dGluZ3MgPSBvcGVuU2V0dGluZ3M7XG5cdFx0dm0udGFibGVTb3J0ID0gJyc7XG5cdFx0dm0udGFibGVBdmdTb3J0ID0gJ2FnZW50Jztcblx0XHR2bS5kYXRhID0gc3RvcmUuZ2V0KCdkYXRhJyk7XG5cblx0XHRpbml0KCk7XG5cdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKSB7XG5cdFx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdFx0dm0uY29sdW1ucyA9IGdldENvbHVtbnMoKTtcblx0XHRcdFx0XG5cdFx0XHRcdHJldHVybiBnZXRUYXNrTGlzdCh2bS5kYXRhKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ3Rhc2tzOiAnLCB0YXNrcyk7XG5cdFx0XHRcdHZtLnRhc2tzID0gdGFza3M7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSB0YXNrcztcblx0XHRcdH0pXG5cdFx0XHQudGhlbihnZXRTdGF0KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBvcGVuU2V0dGluZ3MoJGV2ZW50KSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAncW9zL3Fvcy1zZXR0aW5ncy5odG1sJyxcblx0XHRcdFx0Y29udHJvbGxlcjogJ1Fvc1NldHRpbmdzQ29udHJvbGxlcicsXG5cdFx0XHRcdGNvbnRyb2xsZXJBczogJ3Fvc1NldHRzVm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0bG9jYWxzOiB7XG5cdFx0XHRcdFx0dGFza3M6IHZtLnRhc2tzLFxuXHRcdFx0XHRcdHNlbGVjdGVkVGFza3M6IHZtLnNlbGVjdGVkVGFza3Ncblx0XHRcdFx0fVxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IHJlc3VsdC5zZWxlY3RlZFRhc2tzO1xuXHRcdFx0XHRnZXRTdGF0KCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRDb2x1bW5zKCkge1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcztcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5xb3NjaGVjay5uYW1lLCB0YWJsZXMucW9zY2hlY2suY29sdW1ucy5wcm9jaWRdLmpvaW4oJy4nKSxcblx0XHRcdFx0ZGF0ZTogW3RhYmxlcy5xb3NjaGVjay5uYW1lLCB0YWJsZXMucW9zY2hlY2suY29sdW1ucy5jYWxsc3RhbXBdLmpvaW4oJy4nKSxcblx0XHRcdFx0dGFzazogW3RhYmxlcy5wcm9jZXNzZWQubmFtZSwgJ3Rhc2tpZCddLmpvaW4oJy4nKSxcblx0XHRcdFx0YWdlbnQ6IFt0YWJsZXMucW9zY2hlY2submFtZSwgdGFibGVzLnFvc2NoZWNrLmNvbHVtbnMub3Blcm5hbWVdLmpvaW4oJy4nKSxcblx0XHRcdFx0cGhvbmU6IFt0YWJsZXMucW9zY2hlY2submFtZSwgdGFibGVzLnFvc2NoZWNrLmNvbHVtbnMucGhvbmVdLmpvaW4oJy4nKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXS5qb2luKCcuJyksXG5cdFx0XHRcdHN1YmNhdGVnb3J5OiBbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0uam9pbignLicpLFxuXHRcdFx0XHRjb21wYW55OiBbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuZGVzY3JpcHRpb25dLmpvaW4oJy4nKSxcblx0XHRcdFx0cXVlc3Rpb246IFt0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5uYW1lLCB0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5jb2x1bW5zLnF1ZW51bV0uam9pbignLicpLFxuXHRcdFx0XHRhbnN3ZXI6IFt0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5uYW1lLCB0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5jb2x1bW5zLmFuc3dlcl0uam9pbignLicpLFxuXHRcdFx0XHRjb21tZW50OiBbdGFibGVzLnFvc2NoZWNrLm5hbWUsIHRhYmxlcy5xb3NjaGVjay5jb2x1bW5zLnJlc3VsdF0uam9pbignLicpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFN0YXQoKSB7XG5cdFx0XHR2YXIgdGFibGVzID0gdm0uc2V0dGluZ3MudGFibGVzO1xuXHRcdFx0dmFyIG1ldHJpY3MgPSBbXTtcblxuXHRcdFx0dm0udGFibGVTb3J0ID0gJ2RhdGUnO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdxb3MtbG9hZGVyJyk7XG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdxb3MtYXZnLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jb21wYW5pZXMubmFtZSwgdGFibGVzLnFvc2NoZWNrLm5hbWUsIHRhYmxlcy5xb3NjaGVja19hbnN3ZXJzLm5hbWVdLFxuXHRcdFx0XHR0YWJyZWw6IFxuXHRcdFx0XHRcdFx0J3Rhc2tpZCBpbiAoXFwnJyt2bS5zZWxlY3RlZFRhc2tzLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKStcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5zdWJjYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jb21wYW5pZXMubmFtZSwgdGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMucW9zY2hlY2submFtZSwgdGFibGVzLnFvc2NoZWNrLmNvbHVtbnMucHJvY2lkXS5qb2luKCcuJykrJz0nK1t0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5uYW1lLCB0YWJsZXMucW9zY2hlY2tfYW5zd2Vycy5jb2x1bW5zLnByb2NpZF0uam9pbignLicpLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMucW9zY2hlY2submFtZSwgdGFibGVzLnFvc2NoZWNrLmNvbHVtbnMucHJvY2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IE9iamVjdC5rZXlzKHZtLmNvbHVtbnMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHZtLmNvbHVtbnNba2V5XTsgfSksXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKHNob3dTdGF0KVxuXHRcdFx0LmNhdGNoKGVycm9yU2VydmljZS5zaG93KTtcblxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNob3dTdGF0KHJlc3BvbnNlKSB7XG5cdFx0XHR2YXIgc3RhdCA9IFtdO1xuXHRcdFx0dmFyIGRhdGEgPSByZXNwb25zZS5kYXRhLnJlc3VsdDtcblx0XHRcdHZhciBjb2x1bW5zID0gdm0uY29sdW1ucztcblx0XHRcdC8vIHZhciBxdWVzdGlvbiA9IHt9O1xuXG5cdFx0XHRpZihkYXRhLmxlbmd0aCkge1xuXHRcdFx0XHQvLyB0byBvYmplY3Rcblx0XHRcdFx0c3RhdCA9IGRhdGEucmVkdWNlKGZ1bmN0aW9uKHByZXYsIG5leHQpIHtcblx0XHRcdFx0XHRpZighcHJldltuZXh0W2NvbHVtbnMucHJvY2lkXV0pIHtcblx0XHRcdFx0XHRcdHByZXZbbmV4dFtjb2x1bW5zLnByb2NpZF1dID0gbmV4dDtcblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcmV2W25leHRbY29sdW1ucy5wcm9jaWRdXS5kYXRlID0gbmV4dFtjb2x1bW5zLmRhdGVdO1xuXHRcdFx0XHRcdHByZXZbbmV4dFtjb2x1bW5zLnByb2NpZF1dLnRhc2sgPSBuZXh0W2NvbHVtbnMudGFza107XG5cdFx0XHRcdFx0cHJldltuZXh0W2NvbHVtbnMucHJvY2lkXV0uYWdlbnQgPSBuZXh0W2NvbHVtbnMuYWdlbnRdO1xuXHRcdFx0XHRcdHByZXZbbmV4dFtjb2x1bW5zLnByb2NpZF1dLnBob25lID0gbmV4dFtjb2x1bW5zLnBob25lXTtcblx0XHRcdFx0XHRwcmV2W25leHRbY29sdW1ucy5wcm9jaWRdXS5jYXRlZ29yeSA9IG5leHRbY29sdW1ucy5jYXRlZ29yeV07XG5cdFx0XHRcdFx0cHJldltuZXh0W2NvbHVtbnMucHJvY2lkXV0uc3ViY2F0ZWdvcnkgPSBuZXh0W2NvbHVtbnMuc3ViY2F0ZWdvcnldO1xuXHRcdFx0XHRcdHByZXZbbmV4dFtjb2x1bW5zLnByb2NpZF1dLmNvbXBhbnkgPSBuZXh0W2NvbHVtbnMuY29tcGFueV07XG5cdFx0XHRcdFx0cHJldltuZXh0W2NvbHVtbnMucHJvY2lkXV0uY29tbWVudCA9IG5leHRbY29sdW1ucy5jb21tZW50XTtcblx0XHRcdFx0XHRwcmV2W25leHRbY29sdW1ucy5wcm9jaWRdXS5xdWVzdGlvbnMgPSBwcmV2W25leHRbY29sdW1ucy5wcm9jaWRdXS5xdWVzdGlvbnMgfHwge307XG5cdFx0XHRcdFx0cHJldltuZXh0W2NvbHVtbnMucHJvY2lkXV0ucXVlc3Rpb25zW25leHRbY29sdW1ucy5xdWVzdGlvbl1dID0gcGFyc2VGbG9hdChuZXh0W2NvbHVtbnMuYW5zd2VyXSkgfHwgMDtcblxuXHRcdFx0XHRcdC8vIHByZXZbbmV4dFtjb2x1bW5zLnByb2NpZF1dLnF1ZXN0aW9ucy5wdXNoKHF1ZXN0aW9uKTtcblxuXHRcdFx0XHRcdHJldHVybiBwcmV2O1xuXHRcdFx0XHR9LCB7fSk7XG5cblx0XHRcdFx0Ly8gYmFjayB0byBhcnJheVxuXHRcdFx0XHRzdGF0ID0gT2JqZWN0LmtleXMoc3RhdCkubWFwKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdHJldHVybiBzdGF0W2tleV07XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR2bS5zdGF0ID0gc3RhdDtcblx0XHRcdHZtLnFudW0gPSBzdGF0Lmxlbmd0aCA/IE9iamVjdC5rZXlzKHN0YXRbMF0ucXVlc3Rpb25zKSA6IFtdO1xuXG5cdFx0XHRnZXRBdmdTdGF0KCk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ3Fvcy1sb2FkZXInKTtcblx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ3Fvcy1hdmctbG9hZGVyJyk7XG5cblx0XHRcdGRlYnVnLmxvZygnc2hvd1N0YXQgc3RhdDogJywgc3RhdCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0QXZnU3RhdCgpIHtcblx0XHRcdHZhciBjb2x1bW5zID0gdm0uY29sdW1ucztcblx0XHRcdHZhciBpdGVtID0ge307XG5cdFx0XHR2YXIgdG90YWxBdmcgPSB7fTtcblx0XHRcdHZhciBzdGF0QXZnID0gdm0uc3RhdC5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgbmV4dCkge1xuXHRcdFx0XHRwcmV2W25leHRbY29sdW1ucy5hZ2VudF1dID0gcHJldltuZXh0W2NvbHVtbnMuYWdlbnRdXSB8fCB7fTtcblx0XHRcdFx0aXRlbSA9IHByZXZbbmV4dFtjb2x1bW5zLmFnZW50XV07XG5cdFx0XHRcdGl0ZW0uYWdlbnQgPSBuZXh0W2NvbHVtbnMuYWdlbnRdO1xuXHRcdFx0XHRpdGVtLnF1ZXN0aW9ucyA9IGl0ZW0ucXVlc3Rpb25zIHx8IHt9O1xuXHRcdFx0XHRPYmplY3Qua2V5cyhuZXh0LnF1ZXN0aW9ucykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0XHRpdGVtLnF1ZXN0aW9uc1trZXldID0gaXRlbS5xdWVzdGlvbnNba2V5XSA/IChpdGVtLnF1ZXN0aW9uc1trZXldICsgbmV4dC5xdWVzdGlvbnNba2V5XSkgOiBuZXh0LnF1ZXN0aW9uc1trZXldO1xuXHRcdFx0XHRcdHRvdGFsQXZnW2tleV0gPSB0b3RhbEF2Z1trZXldID8gKHRvdGFsQXZnW2tleV0gKyBuZXh0LnF1ZXN0aW9uc1trZXldKSA6IG5leHQucXVlc3Rpb25zW2tleV07XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpdGVtLmNvdW50ID0gaXRlbS5jb3VudCA/IChpdGVtLmNvdW50KzEpIDogMTtcblxuXHRcdFx0XHRyZXR1cm4gcHJldjtcblx0XHRcdH0sIHt9KTtcblxuXHRcdFx0Ly8gYmFjayB0byBhcnJheVxuXHRcdFx0c3RhdEF2ZyA9IE9iamVjdC5rZXlzKHN0YXRBdmcpLm1hcChmdW5jdGlvbihrZXkpIHtcblx0XHRcdFx0cmV0dXJuIHN0YXRBdmdba2V5XTtcblx0XHRcdH0pO1xuXG5cdFx0XHR2bS5zdGF0QXZnID0gc3RhdEF2Zztcblx0XHRcdHZtLnRvdGFsQXZnID0gdG90YWxBdmc7XG5cblx0XHRcdGRlYnVnLmxvZygnZ2V0QXZnU3RhdDogJywgc3RhdEF2ZywgdG90YWxBdmcpO1xuXG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0xpc3QoZGF0YSkge1xuXHRcdFx0dmFyIHRhc2tzID0gW107XG5cdFx0XHRPYmplY3Qua2V5cyhkYXRhKS5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0dGFza3MgPSB0YXNrcy5jb25jYXQoZGF0YVtpdGVtXS50YXNrcyk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0YXNrcztcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAucW9zJylcbi5jb25maWcoWyckcm91dGVQcm92aWRlcicsIGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKXtcblxuXHQkcm91dGVQcm92aWRlci5cblx0XHR3aGVuKCcvcW9zJywge1xuXHRcdFx0dGVtcGxhdGVVcmw6ICdxb3MvcW9zLmh0bWwnLFxuXHRcdFx0Y29udHJvbGxlcjogJ1Fvc0NvbnRyb2xsZXInLFxuXHRcdFx0Y29udHJvbGxlckFzOiAncW9zVm0nXG5cdFx0fSk7XG59XSk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAubGF5b3V0Jylcblx0XHQuZGlyZWN0aXZlKCdzaWRlTWVudScsIHNpZGVNZW51KTtcblxuXHRmdW5jdGlvbiBzaWRlTWVudSgpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0dHJhbnNjbHVkZTogdHJ1ZSxcblx0XHRcdGNvbnRyb2xsZXI6ICdTaWRlbWVudUNvbnRyb2xsZXInLFxuXHRcdFx0Y29udHJvbGxlckFzOiAnc2lkZW1lbnVWbScsXG5cdFx0XHR0ZW1wbGF0ZVVybDogJ2xheW91dC9zaWRlbWVudS9zaWRlbWVudS5odG1sJ1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1NpZGVtZW51Q29udHJvbGxlcicsIFNpZGVtZW51Q29udHJvbGxlcik7XG5cblx0U2lkZW1lbnVDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJG1kU2lkZW5hdicsICdTZXR0aW5nc1NlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gU2lkZW1lbnVDb250cm9sbGVyKCRyb290U2NvcGUsICRtZFNpZGVuYXYsIFNldHRpbmdzU2VydmljZSwgZXJyb3JTZXJ2aWNlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXHRcdHZtLmlzT3BlbiA9IGZhbHNlO1xuXHRcdHZtLnNldHRpbmdzID0ge307XG5cdFx0dm0udGFibGVzID0ge307XG5cblx0XHQkcm9vdFNjb3BlLiRvbignJHJvdXRlQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYodm0uaXNPcGVuKSBcblx0XHRcdFx0JG1kU2lkZW5hdignc2lkZW5hdicpLnRvZ2dsZSgpO1xuXHRcdH0pO1xuXG5cdFx0U2V0dGluZ3NTZXJ2aWNlLmdldFNldHRpbmdzKClcblx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdHZtLnRhYmxlcyA9IHZtLnNldHRpbmdzLnRhYmxlcztcblx0XHR9KVxuXHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1RvcGJhckNvbnRyb2xsZXInLCBUb3BiYXJDb250cm9sbGVyKTtcblxuXHRUb3BiYXJDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJHNjb3BlJywgJyRtZFNpZGVuYXYnXTtcblxuXHRmdW5jdGlvbiBUb3BiYXJDb250cm9sbGVyKCRyb290U2NvcGUsICRzY29wZSwgJG1kU2lkZW5hdikge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLnRvZ2dsZVNpZGVtZW51ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHQkbWRTaWRlbmF2KCdzaWRlbmF2JykudG9nZ2xlKCk7XG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAubGF5b3V0Jylcblx0XHQuZGlyZWN0aXZlKCd0b3BCYXInLCB0b3BCYXIpO1xuXG5cdGZ1bmN0aW9uIHRvcEJhcigpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0dHJhbnNjbHVkZTogdHJ1ZSxcblx0XHRcdGNvbnRyb2xsZXI6ICdUb3BiYXJDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ3RvcGJhclZtJyxcblx0XHRcdHRlbXBsYXRlVXJsOiAnbGF5b3V0L3RvcGJhci90b3BiYXIuaHRtbCcsXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAnKVxuXHRcdC5kaXJlY3RpdmUoJ3BpY2tlcicsIHBpY2tlcik7XG5cblx0ZnVuY3Rpb24gcGlja2VyKCl7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBRScsXG5cdFx0XHRyZXBsYWNlOiB0cnVlLFxuXHRcdFx0dHJhbnNjbHVkZTogdHJ1ZSxcblx0XHRcdHNjb3BlOiB7XG5cdFx0XHRcdGJlZ2luOiBcIkA/XCIsXG5cdFx0XHRcdGVuZDogXCJAP1wiLFxuXHRcdFx0XHRtaW5EYXRlOiBcIkA/XCIsXG5cdFx0XHRcdG1heERhdGU6IFwiQD9cIixcblx0XHRcdFx0bGFiZWw6IFwiQD9cIixcblx0XHRcdFx0b25TdWJtaXQ6IFwiJj9cIixcblx0XHRcdFx0b25DaGFuZ2U6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGU6IFtcblx0XHRcdFx0JzxtZC1kYXRlcGlja2VyIG5nLWNoYW5nZT17e29uQ2hhbmdlfX0gbmctbW9kZWw9XCJ7e2JlZ2lufX1cIiBtZC1tYXgtZGF0ZT1cInt7bWF4RGF0ZX19XCI+PC9tZC1kYXRlcGlja2VyPicsXG5cdFx0XHRcdCc8bWQtZGF0ZXBpY2tlciBuZy1jaGFuZ2U9e3tvbkNoYW5nZX19IG5nLW1vZGVsPVwie3tlbmR9fVwiIG1kLW1pbi1kYXRlPVwie3ttaW5EYXRlfX1cIj48L21kLWRhdGVwaWNrZXI+Jyxcblx0XHRcdFx0JzxtZC1idXR0b24gY2xhc3M9XCJtZC1wcmltYXJ5XCIgbmctY2xpY2s9XCJ7e29uU3VibWl0fX1cIiBhcmlhLWxhYmVsPVwie3tsYWJlbH19XCI+e3tsYWJlbH19PC9tZC1idXR0b24+Jyxcblx0XHRcdF0uam9pbignJyksXG5cdFx0XHRjb250cm9sbGVyOiBbICckc2NvcGUnLCAnc3RvcmUnLCBmdW5jdGlvbigkc2NvcGUsIHN0b3JlKSB7XG5cdFx0XHRcdFxuXG5cdFx0XHRcdFxuXHRcdFx0fV1cblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1NwaW5uZXJDb250cm9sbGVyJywgU3Bpbm5lckNvbnRyb2xsZXIpO1xuXG5cdFNwaW5uZXJDb250cm9sbGVyLiRpbmplY3QgPSBbJ3NwaW5uZXJTZXJ2aWNlJywgJyRzY29wZSddO1xuXG5cdGZ1bmN0aW9uIFNwaW5uZXJDb250cm9sbGVyKHNwaW5uZXJTZXJ2aWNlLCAkc2NvcGUpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHQvLyByZWdpc3RlciBzaG91bGQgYmUgdHJ1ZSBieSBkZWZhdWx0IGlmIG5vdCBzcGVjaWZpZWQuXG5cdFx0aWYgKCF2bS5oYXNPd25Qcm9wZXJ0eSgncmVnaXN0ZXInKSkge1xuXHRcdFx0dm0ucmVnaXN0ZXIgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2bS5yZWdpc3RlciA9IHZtLnJlZ2lzdGVyLnRvTG93ZXJDYXNlKCkgPT09ICdmYWxzZScgPyBmYWxzZSA6IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gRGVjbGFyZSBhIG1pbmktQVBJIHRvIGhhbmQgb2ZmIHRvIG91ciBzZXJ2aWNlIHNvIHRoZSBzZXJ2aWNlXG5cdFx0Ly8gZG9lc24ndCBoYXZlIGEgZGlyZWN0IHJlZmVyZW5jZSB0byB0aGlzIGRpcmVjdGl2ZSdzIHNjb3BlLlxuXHRcdHZhciBhcGkgPSB7XG5cdFx0XHRuYW1lOiB2bS5uYW1lLFxuXHRcdFx0Z3JvdXA6IHZtLmdyb3VwLFxuXHRcdFx0c2hvdzogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2bS5zaG93ID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHRoaWRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZtLnNob3cgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0b2dnbGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm0uc2hvdyA9ICF2bS5zaG93O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBSZWdpc3RlciB0aGlzIHNwaW5uZXIgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlxuXHRcdGlmICh2bS5yZWdpc3RlciA9PT0gdHJ1ZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ3NwaW5uZXI6ICcsIGFwaSk7XG5cdFx0XHRzcGlubmVyU2VydmljZS5fcmVnaXN0ZXIoYXBpKTtcblx0XHR9XG5cblx0XHQvLyBJZiBhbiBvblNob3cgb3Igb25IaWRlIGV4cHJlc3Npb24gd2FzIHByb3ZpZGVkLCByZWdpc3RlciBhIHdhdGNoZXJcblx0XHQvLyB0aGF0IHdpbGwgZmlyZSB0aGUgcmVsZXZhbnQgZXhwcmVzc2lvbiB3aGVuIHNob3cncyB2YWx1ZSBjaGFuZ2VzLlxuXHRcdGlmICh2bS5vblNob3cgfHwgdm0ub25IaWRlKSB7XG5cdFx0XHQkc2NvcGUuJHdhdGNoKCdzaG93JywgZnVuY3Rpb24gKHNob3cpIHtcblx0XHRcdFx0aWYgKHNob3cgJiYgdm0ub25TaG93KSB7XG5cdFx0XHRcdFx0dm0ub25TaG93KHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIXNob3cgJiYgdm0ub25IaWRlKSB7XG5cdFx0XHRcdFx0dm0ub25IaWRlKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgc3Bpbm5lciBpcyBnb29kIHRvIGdvLiBGaXJlIHRoZSBvbkxvYWRlZCBleHByZXNzaW9uLlxuXHRcdGlmICh2bS5vbkxvYWRlZCkge1xuXHRcdFx0dm0ub25Mb2FkZWQoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwJylcblx0XHQuZGlyZWN0aXZlKCdzcGlubmVyJywgc3Bpbm5lcik7XG5cblx0ZnVuY3Rpb24gc3Bpbm5lcigpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0cmVwbGFjZTogdHJ1ZSxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRzY29wZToge1xuXHRcdFx0XHRuYW1lOiAnQD8nLFxuXHRcdFx0XHRncm91cDogJ0A/Jyxcblx0XHRcdFx0c2hvdzogJ0A/Jyxcblx0XHRcdFx0aW1nU3JjOiAnQD8nLFxuXHRcdFx0XHRyZWdpc3RlcjogJ0A/Jyxcblx0XHRcdFx0b25Mb2FkZWQ6ICcmPycsXG5cdFx0XHRcdG9uU2hvdzogJyY/Jyxcblx0XHRcdFx0b25IaWRlOiAnJj8nXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGU6IFtcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJzcGlubmVyLWxvYWRlciBhbmltYXRlLXNob3dcIiBuZy1zaG93PVwic2hvd1wiPicsXG5cdFx0XHRcdCcgIDxpbWcgbmctaWY9XCJpbWdTcmNcIiBuZy1zcmM9XCJ7e2ltZ1NyY319XCIgLz4nLFxuXHRcdFx0XHQnICA8bmctdHJhbnNjbHVkZT48L25nLXRyYW5zY2x1ZGU+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJyksXG5cdFx0XHRjb250cm9sbGVyOiBbICckc2NvcGUnLCAnc3Bpbm5lclNlcnZpY2UnLCBmdW5jdGlvbigkc2NvcGUsIHNwaW5uZXJTZXJ2aWNlKSB7XG5cdFx0XHRcdC8vIHJlZ2lzdGVyIHNob3VsZCBiZSB0cnVlIGJ5IGRlZmF1bHQgaWYgbm90IHNwZWNpZmllZC5cblx0XHRcdFx0aWYgKCEkc2NvcGUuaGFzT3duUHJvcGVydHkoJ3JlZ2lzdGVyJykpIHtcblx0XHRcdFx0XHQkc2NvcGUucmVnaXN0ZXIgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdCRzY29wZS5yZWdpc3RlciA9ICRzY29wZS5yZWdpc3Rlci50b0xvd2VyQ2FzZSgpID09PSAnZmFsc2UnID8gZmFsc2UgOiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRGVjbGFyZSBhIG1pbmktQVBJIHRvIGhhbmQgb2ZmIHRvIG91ciBzZXJ2aWNlIHNvIHRoZSBzZXJ2aWNlXG5cdFx0XHRcdC8vIGRvZXNuJ3QgaGF2ZSBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhpcyBkaXJlY3RpdmUncyBzY29wZS5cblx0XHRcdFx0dmFyIGFwaSA9IHtcblx0XHRcdFx0XHRuYW1lOiAkc2NvcGUubmFtZSxcblx0XHRcdFx0XHRncm91cDogJHNjb3BlLmdyb3VwLFxuXHRcdFx0XHRcdHNob3c6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGhpZGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gZmFsc2U7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0b2dnbGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gISRzY29wZS5zaG93O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBSZWdpc3RlciB0aGlzIHNwaW5uZXIgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlxuXHRcdFx0XHRpZiAoJHNjb3BlLnJlZ2lzdGVyID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ3NwaW5uZXI6ICcsIGFwaSk7XG5cdFx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuX3JlZ2lzdGVyKGFwaSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiBhbiBvblNob3cgb3Igb25IaWRlIGV4cHJlc3Npb24gd2FzIHByb3ZpZGVkLCByZWdpc3RlciBhIHdhdGNoZXJcblx0XHRcdFx0Ly8gdGhhdCB3aWxsIGZpcmUgdGhlIHJlbGV2YW50IGV4cHJlc3Npb24gd2hlbiBzaG93J3MgdmFsdWUgY2hhbmdlcy5cblx0XHRcdFx0aWYgKCRzY29wZS5vblNob3cgfHwgJHNjb3BlLm9uSGlkZSkge1xuXHRcdFx0XHRcdCRzY29wZS4kd2F0Y2goJ3Nob3cnLCBmdW5jdGlvbiAoc2hvdykge1xuXHRcdFx0XHRcdFx0aWYgKHNob3cgJiYgJHNjb3BlLm9uU2hvdykge1xuXHRcdFx0XHRcdFx0XHQkc2NvcGUub25TaG93KHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFzaG93ICYmICRzY29wZS5vbkhpZGUpIHtcblx0XHRcdFx0XHRcdFx0JHNjb3BlLm9uSGlkZSh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gVGhpcyBzcGlubmVyIGlzIGdvb2QgdG8gZ28uIEZpcmUgdGhlIG9uTG9hZGVkIGV4cHJlc3Npb24uXG5cdFx0XHRcdGlmICgkc2NvcGUub25Mb2FkZWQpIHtcblx0XHRcdFx0XHQkc2NvcGUub25Mb2FkZWQoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ3NwaW5uZXJTZXJ2aWNlJywgc3Bpbm5lclNlcnZpY2UpO1xuXG4gICAgZnVuY3Rpb24gc3Bpbm5lclNlcnZpY2UoKXtcblxuICAgICAgICB2YXIgc3Bpbm5lcnMgPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBfcmVnaXN0ZXI6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmhhc093blByb3BlcnR5KCduYW1lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJTcGlubmVyIG11c3Qgc3BlY2lmeSBhIG5hbWUgd2hlbiByZWdpc3RlcmluZyB3aXRoIHRoZSBzcGlubmVyIHNlcnZpY2UuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNwaW5uZXJzLmhhc093blByb3BlcnR5KGRhdGEubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJBIHNwaW5uZXIgd2l0aCB0aGUgbmFtZSAnXCIgKyBkYXRhLm5hbWUgKyBcIicgaGFzIGFscmVhZHkgYmVlbiByZWdpc3RlcmVkLlwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNwaW5uZXJzW2RhdGEubmFtZV0gPSBkYXRhO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNob3c6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNwaW5uZXIgPSBzcGlubmVyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIXNwaW5uZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJObyBzcGlubmVyIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgcmVnaXN0ZXJlZC5cIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcGlubmVyLnNob3coKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoaWRlOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBzcGlubmVyID0gc3Bpbm5lcnNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFzcGlubmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHNwaW5uZXIgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyByZWdpc3RlcmVkLlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3Bpbm5lci5oaWRlKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2hvd0FsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc3Bpbm5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lcnNbbmFtZV0uc2hvdygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoaWRlQWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzcGlubmVycykge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyc1tuYW1lXS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgfVxuXG59KSgpOyJdfQ==
