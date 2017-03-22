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
				.then(function() {
					if(vm.options.callstable.columns.login) {
						debug.log('vm.options.callstable.columns.login: ', vm.options.callstable.columns.login);
						return getLoginsRatio();
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

		function getLoginsRatio() {
			var data, tables = vm.options.db.tables, taskKind = 1,
			rdata = {},
			metrics = ['count(case when probcat != 0 then probcat else null end) as tlogins'];

			return api.getCustomListStatistics({
				tables: [tables.calls.name],
				// tabrel: 'probstat.probcat=probcat.catid and probstat.probcompany=probcompany.compid',
				tabrel: 'taskid in (\''+getTaskIds([taskKind]).join('\',\'')+'\')',
						// 'and '+[tables.calls.name, tables.calls.columns.callresult].join('.')+' = 1',
				procid: [tables.calls.name, tables.calls.columns.process_id].join('.'),
				columns: [tables.calls.columns.login],
				// columns: [tables.calls.columns.category, tables.categories.columns.description],
				begin: vm.begin.valueOf(),
				end: vm.end.valueOf(),
				metrics: metrics
			}).then(function(result){
				debug.log('getLoginsRatio data: ', result.data);
				if(result.data && result.data.result && result.data.result.length) {
					rdata = result.data.result[0];
					vm.stat = vm.stat || {};
					vm.stat[utils.getFriendlyKind(taskKind)] = vm.stat[utils.getFriendlyKind(taskKind)] || {};
					vm.stat[utils.getFriendlyKind(taskKind)].ncu = rdata.tlogins;
					
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFwcC5jb25maWcuanMiLCJhcHAuY29yZS5qcyIsImFwcC5jcnIuanMiLCJhcHAuZGFzaGJvYXJkLmpzIiwiYXBwLmxheW91dC5qcyIsImFwcC5yb3V0ZXMuanMiLCJkYXNoYm9hcmQvZGFzaGJvYXJkLWV4cG9ydC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC1zZXR0aW5ncy5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL2Rhc2hib2FyZC5yb3V0ZS5qcyIsImRhc2hib2FyZC9raW5kLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJkYXNoYm9hcmQvcHJvY2Vzc2VzLWV4cG9ydC5jb250cm9sbGVyLmpzIiwiZGFzaGJvYXJkL3N0YXQtY2FyZC5kaXJlY3RpdmUuanMiLCJjcnIvY3JyLXNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJjcnIvY3JyLmNvbnRyb2xsZXIuanMiLCJjcnIvY3JyLnJvdXRlLmpzIiwiZmlsdGVycy9maWx0ZXJzLmpzIiwic2VydmljZXMvYXBpLmpzIiwic2VydmljZXMvY29sb3VyLWdlbi5qcyIsInNlcnZpY2VzL2RlYnVnLmpzIiwic2VydmljZXMvZXJyb3IuanMiLCJzZXJ2aWNlcy9zZXR0aW5ncy5qcyIsInNlcnZpY2VzL3Rhc2tzLmpzIiwic2VydmljZXMvdXRpbHMuanMiLCJsYXlvdXQvbGF5b3V0LmNvbnRyb2xsZXIuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvX19zcGlubmVyLmNvbnRyb2xsZXIuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5kaXJlY3RpdmUuanMiLCJjb21wb25lbnRzL3NwaW5uZXIvc3Bpbm5lci5zZXJ2aWNlLmpzIiwibGF5b3V0L3NpZGVtZW51L3NpZGUtbWVudS5kaXJlY3RpdmUuanMiLCJsYXlvdXQvc2lkZW1lbnUvc2lkZW1lbnUuY29udHJvbGxlci5qcyIsImxheW91dC90b3BiYXIvdG9wLWJhci5jb250cm9sbGVyLmpzIiwibGF5b3V0L3RvcGJhci90b3AtYmFyLmRpcmVjdGl2ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDUEE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6b0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDakZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFsbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImFuZ3VsYXIubW9kdWxlKCdhcHAnLCBbXG5cdCdhcHAuY29yZScsXG5cdCdhcHAuY29uZmlnJyxcblx0J2FwcC5yb3V0ZXMnLFxuXHQnYXBwLmxheW91dCcsXG5cdCdhcHAuY3JyJyxcblx0J2FwcC5kYXNoYm9hcmQnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmNvbmZpZycsIFtcblx0J2FwcC5jb3JlJ1xuXSlcbi5jb25zdGFudCgnYXBwQ29uZmlnJywge1xuXHRzZXJ2ZXI6IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCArICcvLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdFxufSlcbi5jb25maWcoWyckY29tcGlsZVByb3ZpZGVyJywgZnVuY3Rpb24gKCRjb21waWxlUHJvdmlkZXIpIHtcbiAgJGNvbXBpbGVQcm92aWRlci5kZWJ1Z0luZm9FbmFibGVkKGZhbHNlKTtcbn1dKVxuLmNvbmZpZyhbJ0NoYXJ0SnNQcm92aWRlcicsZnVuY3Rpb24oQ2hhcnRKc1Byb3ZpZGVyKSB7XG5cdENoYXJ0SnNQcm92aWRlci5zZXRPcHRpb25zKHtcblx0XHRsZWdlbmRUZW1wbGF0ZSA6IFwiPHVsIGNsYXNzPVxcXCJjdXN0b20tbGVnZW5kIDwlPW5hbWUudG9Mb3dlckNhc2UoKSU+LWxlZ2VuZFxcXCI+PCUgZm9yICh2YXIgaT0wOyBpPHNlZ21lbnRzLmxlbmd0aDsgaSsrKXslPjxsaT48c3BhbiBzdHlsZT1cXFwiYmFja2dyb3VuZC1jb2xvcjo8JT1zZWdtZW50c1tpXS5maWxsQ29sb3IlPlxcXCI+PC9zcGFuPjwlaWYoc2VnbWVudHNbaV0ubGFiZWwpeyU+PCU9c2VnbWVudHNbaV0ubGFiZWwlPjwlfSU+PC9saT48JX0lPjwvdWw+XCJcblx0fSk7XG59XSk7XG5cbi8vIC5jb25maWcoWyckbWRUaGVtaW5nUHJvdmlkZXInLGZ1bmN0aW9uKCRtZFRoZW1pbmdQcm92aWRlcikge1xuLy8gXHQkbWRUaGVtaW5nUHJvdmlkZXIudGhlbWUoJ2N5YW4nKTtcbi8vIH1dKVxuLy8gLmNvbmZpZyhbJyR0cmFuc2xhdGVQcm92aWRlcicsIGZ1bmN0aW9uKCR0cmFuc2xhdGVQcm92aWRlcikge1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU3RhdGljRmlsZXNMb2FkZXIoe1xuLy8gXHRcdHByZWZpeDogJy90cmFuc2xhdGlvbnMvbG9jYWxlLScsXG4vLyBcdFx0c3VmZml4OiAnLmpzb24nXG4vLyBcdH0pO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIucHJlZmVycmVkTGFuZ3VhZ2UoJ2VuJyk7XG4vLyBcdCR0cmFuc2xhdGVQcm92aWRlci5mYWxsYmFja0xhbmd1YWdlKCdlbicpO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU3RvcmFnZSgnc3RvcmFnZScpO1xuLy8gXHQkdHJhbnNsYXRlUHJvdmlkZXIudXNlU2FuaXRpemVWYWx1ZVN0cmF0ZWd5KCdzYW5pdGl6ZVBhcmFtZXRlcnMnKTtcbi8vIFx0Ly8gJHRyYW5zbGF0ZVByb3ZpZGVyLnVzZVNhbml0aXplVmFsdWVTdHJhdGVneSgnZXNjYXBlJyk7XG4vLyB9XSlcbi8vIC5jb25maWcoWyd0bWhEeW5hbWljTG9jYWxlUHJvdmlkZXInLCBmdW5jdGlvbih0bWhEeW5hbWljTG9jYWxlUHJvdmlkZXIpIHtcbi8vIFx0dG1oRHluYW1pY0xvY2FsZVByb3ZpZGVyLmxvY2FsZUxvY2F0aW9uUGF0dGVybignLi9qcy9saWIvaTE4bi9hbmd1bGFyLWxvY2FsZV97e2xvY2FsZX19LmpzJyk7XG4vLyB9XSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5jb3JlJywgW1xuXHQnbmdBbmltYXRlJyxcblx0J25nTWF0ZXJpYWwnLFxuXHQnYW5ndWxhck1vbWVudCcsXG5cdCdhbmd1bGFyLXN0b3JhZ2UnLFxuXHQnbWQuZGF0YS50YWJsZScsXG5cdCdjaGFydC5qcydcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuY3JyJywgW1xuXHQnYXBwLmNvcmUnXG5dKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmRhc2hib2FyZCcsIFtcblx0J2FwcC5jb3JlJ1xuXSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcC5sYXlvdXQnLCBbXG5cdCdhcHAuY29yZSdcbl0pOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAucm91dGVzJywgW1xuXHQnbmdSb3V0ZSdcbl0pXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0b3RoZXJ3aXNlKHtcblx0XHRcdHJlZGlyZWN0VG86ICcvZGFzaGJvYXJkJ1xuXHRcdH0pO1xufV0pOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ0Rhc2hFeHBvcnRDb250cm9sbGVyJywgRGFzaEV4cG9ydENvbnRyb2xsZXIpO1xuXG5cdERhc2hFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRtZERpYWxvZycsICdraW5kcycsICd0YWJsZXMnLCAnZGF0YScsICdiZWdpbicsICdlbmQnLCAnc3RhdCcsICdwcmV2c3RhdCcsICdjYXRzdGF0J107XG5cblx0ZnVuY3Rpb24gRGFzaEV4cG9ydENvbnRyb2xsZXIoJG1kRGlhbG9nLCBraW5kcywgdGFibGVzLCBkYXRhLCBiZWdpbiwgZW5kLCBzdGF0LCBwcmV2c3RhdCwgY2F0c3RhdCkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLmtpbmRzID0ga2luZHM7XG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLnN0YXQgPSBzdGF0O1xuXHRcdHZtLnByZXZzdGF0ID0gcHJldnN0YXQ7XG5cdFx0dm0uY2F0c3RhdCA9IGNhdHN0YXQ7XG5cdFx0dm0uY2xvc2UgPSBmdW5jdGlvbigpe1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoKTtcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5kYXNoYm9hcmQnKVxuXHRcdC5jb250cm9sbGVyKCdEYXNoU2V0dGluZ3NDb250cm9sbGVyJywgRGFzaFNldHRpbmdzQ29udHJvbGxlcik7XG5cblx0RGFzaFNldHRpbmdzQ29udHJvbGxlci4kaW5qZWN0ID0gWyckbWREaWFsb2cnLCAnb3B0aW9ucyddO1xuXG5cdGZ1bmN0aW9uIERhc2hTZXR0aW5nc0NvbnRyb2xsZXIoJG1kRGlhbG9nLCBvcHRpb25zKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0ub3B0aW9ucyA9IGFuZ3VsYXIuY29weShvcHRpb25zLCB7fSk7XG5cdFx0dm0ucGVyaW9kcyA9IFsnMSBob3VyJywgJzEgZGF5JywgJzEgd2VlaycsICcxIG1vbnRoJywgJzEgeWVhciddO1xuXHRcdHZtLmludGVydmFscyA9IFsnMSBtaW51dGVzJywgJzUgbWludXRlcycsICcxMCBtaW51dGVzJywgJzIwIG1pbnV0ZXMnLCAnMzAgbWludXRlcycsICcxIGhvdXInXTtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmluZGV4ID0gaW5kZXg7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0JG1kRGlhbG9nLmhpZGUoe1xuXHRcdFx0XHRvcHRpb25zOiB2bS5vcHRpb25zXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gdm0uaW5kZXgoaXRlbSwgbGlzdCk7XG5cdFx0XHRpZiAoaWR4ID4gLTEpIGxpc3Quc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRlbHNlIGxpc3QucHVzaChpdGVtKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbmRleChpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gLTE7XG5cdFx0XHRsaXN0LmZvckVhY2goZnVuY3Rpb24obGlzdEl0ZW0sIGluZGV4KXtcblx0XHRcdFx0aWYobGlzdEl0ZW0ua2luZCA9PSBpdGVtLmtpbmQpIGlkeCA9IGluZGV4O1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gaWR4O1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignRGFzaENvbnRyb2xsZXInLCBEYXNoQ29udHJvbGxlcik7XG5cblx0RGFzaENvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckc2NvcGUnLCAnJHRpbWVvdXQnLCAnJHEnLCAnJG1kTWVkaWEnLCAnJG1kQm90dG9tU2hlZXQnLCAnJG1kRGlhbG9nJywgJyRtZFRvYXN0JywgJ3N0b3JlJywgJ1NldHRpbmdzU2VydmljZScsICdhcGlTZXJ2aWNlJywgJ3NwaW5uZXJTZXJ2aWNlJywgJ2NvbG91ckdlbmVyYXRvcicsICdkZWJ1Z1NlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJywgJ3V0aWxzU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIERhc2hDb250cm9sbGVyKCRyb290U2NvcGUsICRzY29wZSwgJHRpbWVvdXQsICRxLCAkbWRNZWRpYSwgJG1kQm90dG9tU2hlZXQsICRtZERpYWxvZywgJG1kVG9hc3QsIHN0b3JlLCBTZXR0aW5nc1NlcnZpY2UsIGFwaSwgc3Bpbm5lclNlcnZpY2UsIGNvbG91ckdlbmVyYXRvciwgZGVidWcsIGVycm9yU2VydmljZSwgdXRpbHMpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cdFx0dmFyIGRlZmF1bHREYXRhID0ge1xuXHRcdFx0SW5jb21pbmdfQWdlbnQ6IHtcblx0XHRcdFx0a2luZDogMSxcblx0XHRcdFx0dGFza3M6IFtdLFxuXHRcdFx0XHRsaXN0OiBbXSxcblx0XHRcdFx0c2w6IDIwLFxuXHRcdFx0XHRtZXRyaWNzOiBbJ2FodCcsICdhdHQnLCAnbmNvJywgJ25jYScsICdjYXInLCAnYXNhJ11cblx0XHRcdH0sXG5cdFx0XHRNZXNzYWdpbmdfQ2hhdDoge1xuXHRcdFx0XHRraW5kOiA3LFxuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRzbDogNSxcblx0XHRcdFx0bWV0cmljczogWydhaHQnLCAnYXR0JywgJ25jbycsICduY2EnLCAnY2FyJ11cblx0XHRcdH0sXG5cdFx0XHRBdXRvZGlhbF9BZ2VudDoge1xuXHRcdFx0XHRraW5kOiAxMjksXG5cdFx0XHRcdHRhc2tzOiBbXSxcblx0XHRcdFx0bGlzdDogW10sXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJ11cblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0czoge1xuXHRcdFx0XHR0YXNrczogW10sXG5cdFx0XHRcdGxpc3Q6IFtdLFxuXHRcdFx0XHRzbDogMjAsXG5cdFx0XHRcdG1ldHJpY3M6IFsnYWh0JywgJ2F0dCcsICduY28nLCAnbmNhJywgJ2NhciddXG5cdFx0XHR9XG5cdFx0XHRcdFxuXHRcdH0sXG5cdFx0ZGVmYXVsdE9wdGlvbnMgPSB7XG5cdFx0XHRhdXRvdXBkYXRlOiBmYWxzZSxcblx0XHRcdHVwZGF0ZUV2ZXJ5OiAnMSBtaW51dGVzJyxcblx0XHRcdGtpbmRzOiBbe25hbWU6ICdJbmNvbWluZ19BZ2VudCcsIGtpbmQ6IDF9XSxcblx0XHRcdGtpbmRzTGlzdDogW3tuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfSwge25hbWU6ICdNZXNzYWdpbmdfQ2hhdCcsIGtpbmQ6IDd9LCB7bmFtZTogJ0F1dG9kaWFsX0FnZW50Jywga2luZDogMTI5fV0sXG5cdFx0XHQvLyBraW5kczogWzEsIDcsIDEyOV0sXG5cdFx0XHRzbDogWzUsIDEwLCAxNSwgMjAsIDI1LCAzMCwgMzUsIDQwXSxcblx0XHRcdGRiOiB7fSxcblx0XHRcdHRhYmxlczogW10sXG5cdFx0XHRwZXJpb2Q6ICcxIGRheScsXG5cdFx0XHRjYXRDb2xvdXJzOiBbXSxcblx0XHRcdGNhdG9yZGVyOiAnY2F0ZGVzYycgLy8gY2hhbmdlZCBkdXJpbmcgdGhlIGRhc2hib2FyZCBpbml0aWF0aW9uIHRvIHRoZSB2YWx1ZSBmcm9tIHRoZSBjb25maWcgZmlsZVxuXHRcdH0sXG5cdFx0dXBkYXRlVGltZW91dCA9IG51bGw7XG5cblx0XHR2bS5vcHRpb25zID0gZ2V0RGVmYXVsdE9wdGlvbnMoKTtcblx0XHR2bS5kYXRhID0gZ2V0RGVmYXVsdERhdGEoKTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2Uodm0ub3B0aW9ucy5wZXJpb2QpLmJlZ2luO1xuXHRcdHZtLmVuZCA9IHV0aWxzLnBlcmlvZFRvUmFuZ2Uodm0ub3B0aW9ucy5wZXJpb2QpLmVuZDtcblx0XHR2bS5zdGF0ID0ge307XG5cdFx0dm0ucHJldnN0YXQgPSB7fTtcblx0XHR2bS5jYXRzdGF0ID0gW107XG5cdFx0dm0uZ2xvYmFsQ3IgPSB7fTtcblx0XHQvLyB2bS5jYXRUb3RhbHMgPSB7fTtcblx0XHQvLyB2bS5zdWJjYXRUb3RhbHMgPSB7fTtcblx0XHR2bS5zZWxlY3RlZENhdCA9IG51bGw7XG5cdFx0dm0uc3ViQ2F0c1N0YXQgPSBbXTtcblx0XHR2bS5jYXRjaGFydERhdGEgPSB7fTtcblx0XHR2bS5jYXRjaGFydExhYmVsID0gJ25jYSc7XG5cdFx0dm0uY2F0TWV0cmljcyA9IFt7IGluZGV4OiAnbmNhJywgbmFtZTogJ051bWJlciBvZiBjYWxscyBhbnN3ZXJlZCcgfSwgeyBpbmRleDogJ2FodCcsIG5hbWU6ICdBdmVyYWdlIGhhbmRsZSB0aW1lJyB9LCB7IGluZGV4OiAnYXR0JywgbmFtZTogJ0F2ZXJhZ2UgdGFsayB0aW1lJyB9XTtcblx0XHR2bS50b3RhbEJ5Q2F0ZWdvcnkgPSB7fTtcblx0XHR2bS51c2VyRnVsbFNjcmVlbiA9ICRtZE1lZGlhKCd4cycpO1xuXHRcdHZtLmFiUmF0ZSA9IHV0aWxzLmdldEFiYW5kb25tZW50UmF0ZTtcblx0XHQvLyB2bS5nZXRGcmllbmRseUtpbmQgPSBnZXRGcmllbmRseUtpbmQ7XG5cdFx0dm0ub3BlbkRhc2hTZXR0aW5ncyA9IG9wZW5EYXNoU2V0dGluZ3M7XG5cdFx0dm0ub25DYXRTZWxlY3QgPSBvbkNhdFNlbGVjdDtcblx0XHR2bS5vblN1YkNhdFNlbGVjdCA9IG9uU3ViQ2F0U2VsZWN0O1xuXHRcdHZtLmdldFN0YXQgPSBnZXRTdGF0O1xuXHRcdHZtLm9wZW5TZXR0aW5ncyA9IG9wZW5TZXR0aW5ncztcblx0XHR2bS5leHBvcnREYXNoID0gZXhwb3J0RGFzaDtcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdm0ub3B0aW9ucztcblx0XHR9LCBmdW5jdGlvbihuZXdWYWx1ZSwgcHJldlZhbHVlKSB7XG5cdFx0XHRkZWJ1Zy5sb2coJ09wdGlvbnMgY2hhbmdlZCEhIScsIG5ld1ZhbHVlKTtcblx0XHRcdHN0b3JlLnNldCgnb3B0aW9ucycsIG5ld1ZhbHVlKTtcblx0XHR9KTtcblx0XHQkc2NvcGUuJHdhdGNoKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZtLmNhdGNoYXJ0TGFiZWw7XG5cdFx0fSwgZnVuY3Rpb24obmV3VmFsdWUsIHByZXZWYWx1ZSkge1xuXHRcdFx0aWYodm0uc2VsZWN0ZWRDYXQpXG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IHNldENhdGNoYXJ0RGF0YSh2bS5zdWJDYXRzU3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdm0ub3B0aW9ucy5kYi50YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uKTtcblx0XHRcdGVsc2Vcblx0XHRcdFx0aWYodm0ub3B0aW9ucy5kYi50YWJsZXMpIHZtLmNhdGNoYXJ0RGF0YSA9IHNldENhdGNoYXJ0RGF0YSh2bS5jYXRzdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24pO1xuXHRcdH0pO1xuXHRcdCRzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XG5cdFx0XHQkdGltZW91dC5jYW5jZWwodXBkYXRlVGltZW91dCk7XG5cdFx0XHR1cGRhdGVUaW1lb3V0ID0gbnVsbDtcblx0XHR9KTtcblxuXHRcdC8vIEdldCBEQiBzZXR0aW5ncyBhbmQgaW5pdCB0aGUgRGFzaGJvYXJkXG5cdFx0U2V0dGluZ3NTZXJ2aWNlLmdldFNldHRpbmdzKClcblx0XHQudGhlbihmdW5jdGlvbihkYlNldHRpbmdzKXtcblx0XHRcdGRlYnVnLmxvZygnREIgc2V0dGluZ3MnLCBkYlNldHRpbmdzKTtcblx0XHRcdHZhciB0YWJsZXMgPSBkYlNldHRpbmdzLnRhYmxlcyxcblx0XHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0XHRkYjogZGJTZXR0aW5ncyxcblx0XHRcdFx0XHR0YWJsZXNMaXN0OiBbXSxcblx0XHRcdFx0XHRjYWxsc3RhYmxlOiB0YWJsZXMuY2FsbHMsXG5cdFx0XHRcdFx0Y2F0dGFibGU6IHRhYmxlcy5jYXRlZ29yaWVzLFxuXHRcdFx0XHRcdHN1YmNhdHRhYmxlOiB0YWJsZXMuc3ViY2F0ZWdvcmllcyxcblx0XHRcdFx0XHRjYXRvcmRlcjogdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvblxuXHRcdFx0XHR9O1xuXG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh2bS5vcHRpb25zLCBvcHRpb25zKTtcblx0XHRcdGFuZ3VsYXIuZm9yRWFjaCh0YWJsZXMsIGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdFx0XHRpZihpdGVtLm5hbWUpIHZtLm9wdGlvbnMudGFibGVzTGlzdC5wdXNoKGl0ZW0ubmFtZSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0aW5pdCgpO1xuXHRcdFx0YXV0b1VwZGF0ZSgpO1xuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gaW5pdCgpe1xuXHRcdFx0aWYoIXZtLm9wdGlvbnMua2luZHMubGVuZ3RoKSByZXR1cm4gc3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdFx0dm0ub3B0aW9ucy5raW5kcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4LCBhcnJheSkge1xuXHRcdFx0XHRhcGkuZ2V0VGFza3MoeyBraW5kOiBpdGVtLmtpbmQgfSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNldFRhc2tzKHJlc3VsdCwgaXRlbSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKHRhc2tzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdldFN0YXREYXRhKHZtLmRhdGFbaXRlbS5uYW1lXS5saXN0IHx8IHRhc2tzLCBpdGVtKTtcblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZnVuY3Rpb24oKXtcblx0XHRcdFx0XHRpZih2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5jYWxscmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0Q2FsbFJlc29sdXRpb25TdGF0KCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAkcS5kZWZlcigpLnJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmKHZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luKSB7XG5cdFx0XHRcdFx0XHRkZWJ1Zy5sb2coJ3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmxvZ2luOiAnLCB2bS5vcHRpb25zLmNhbGxzdGFibGUuY29sdW1ucy5sb2dpbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZ2V0TG9naW5zUmF0aW8oKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICRxLmRlZmVyKCkucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oZ2V0Q2F0ZWdvcmllc1N0YXQpXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYoaW5kZXggPT09IGFycmF5Lmxlbmd0aC0xKSBzcGlubmVyU2VydmljZS5oaWRlKCdtYWluLWxvYWRlcicpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gYXV0b1VwZGF0ZSgpe1xuXHRcdFx0dmFyIGR1ciA9IHZtLm9wdGlvbnMudXBkYXRlRXZlcnkuc3BsaXQoJyAnKTtcblx0XHRcdHVwZGF0ZVRpbWVvdXQgPSAkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYodm0ub3B0aW9ucy5hdXRvdXBkYXRlKSB2bS5nZXRTdGF0KCk7XG5cdFx0XHRcdGF1dG9VcGRhdGUoKTtcblx0XHRcdH0sIG1vbWVudC5kdXJhdGlvbihwYXJzZUludChkdXJbMF0sIDEwKSwgZHVyWzFdKS5fbWlsbGlzZWNvbmRzKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdGF0KGtpbmRzKSB7XG5cdFx0XHR2YXIga2luZHNMaXN0ID0ga2luZHMgfHwgdm0ub3B0aW9ucy5raW5kcztcblx0XHRcdGtpbmRzTGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdyhpdGVtLm5hbWUrJy1sb2FkZXInKTtcblx0XHRcdFx0Z2V0U3RhdERhdGEodm0uZGF0YVtpdGVtLm5hbWVdLmxpc3QsIGl0ZW0pXG5cdFx0XHRcdC50aGVuKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0aWYodm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2FsbHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGdldENhbGxSZXNvbHV0aW9uU3RhdCgpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJHEuZGVmZXIoKS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0XHQudGhlbihmdW5jdGlvbigpeyBzcGlubmVyU2VydmljZS5oaWRlKGl0ZW0ubmFtZSsnLWxvYWRlcicpOyB9KVxuXHRcdFx0XHQuY2F0Y2goZnVuY3Rpb24oKXsgc3Bpbm5lclNlcnZpY2UuaGlkZShpdGVtLm5hbWUrJy1sb2FkZXInKTsgfSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Z2V0Q2F0ZWdvcmllc1N0YXQoKTtcblxuXHRcdFx0JG1kVG9hc3Quc2hvdyhcblx0XHRcdFx0JG1kVG9hc3Quc2ltcGxlKClcblx0XHRcdFx0XHQudGV4dENvbnRlbnQoJ1VwZGF0aW5nIGluZGV4ZXMnKVxuXHRcdFx0XHRcdC5wb3NpdGlvbigndG9wIHJpZ2h0Jylcblx0XHRcdFx0XHQuaGlkZURlbGF5KDIwMDApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5EYXNoU2V0dGluZ3MoJGV2ZW50KSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2Rhc2gtc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoU2V0dGluZ3NDb250cm9sbGVyJyxcblx0XHRcdFx0Y29udHJvbGxlckFzOiAnZGFzaFNldFZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdG9wdGlvbnM6IHZtLm9wdGlvbnNcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ21haW4tbG9hZGVyJyk7XG5cdFx0XHRcdHZtLm9wdGlvbnMgPSByZXN1bHQub3B0aW9ucztcblx0XHRcdFx0aW5pdCgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb25DYXRTZWxlY3QoY2F0LCBpbmRleCkge1xuXHRcdFx0aWYodm0uc2VsZWN0ZWRDYXQgJiYgKCFjYXQgfHwgY2F0W3ZtLm9wdGlvbnMuY2FsbHN0YWJsZS5jb2x1bW5zLmNhdGVnb3J5XSA9PT0gdm0uc2VsZWN0ZWRDYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldKSkge1xuXHRcdFx0XHR2bS5zZWxlY3RlZENhdCA9IG51bGw7XG5cdFx0XHRcdHZtLnN1YkNhdHNTdGF0ID0gW107XG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IHNldENhdGNoYXJ0RGF0YSh2bS5jYXRzdGF0LCB2bS5jYXRjaGFydExhYmVsLCB2bS5vcHRpb25zLmRiLnRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHZtLnNlbGVjdGVkQ2F0ID0gY2F0O1xuXG5cdFx0XHRnZXRTdWJDYXRlZ29yaWVzU3RhdChjYXRbdm0ub3B0aW9ucy5jYWxsc3RhYmxlLmNvbHVtbnMuY2F0ZWdvcnldKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGEsIHRvdGFscyA9IHt9O1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0aWYoIWRhdGEucmVzdWx0Lmxlbmd0aCkgcmV0dXJuO1xuXG5cdFx0XHRcdC8vIHZtLnN1YmNhdFRvdGFscyA9IGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXHRcdFx0XHR2bS5zdWJDYXRzU3RhdCA9IHNldENhdHNTdGF0KGRhdGEucmVzdWx0LCBkYXRhLnJlc3VsdC5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKSk7XG5cdFx0XHRcdHZtLmNhdGNoYXJ0RGF0YSA9IHNldENhdGNoYXJ0RGF0YSh2bS5zdWJDYXRzU3RhdCwgdm0uY2F0Y2hhcnRMYWJlbCwgdm0ub3B0aW9ucy5kYi50YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9uU3ViQ2F0U2VsZWN0KGNhdCwgc3ViY2F0LCBpbmRleCkge1xuXHRcdFx0dmFyIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0XHR0Y29scyA9IHRhYmxlcy5jYWxscy5jb2x1bW5zLFxuXHRcdFx0XHRjb2x1bW5zID0gW3Rjb2xzLm9wZXJhdG9yLCB0Y29scy5jdXN0b21lcl9waG9uZSwgdGNvbHMuY2FsbGRhdGUsIHRjb2xzLmNvbW1lbnRzXSxcblx0XHRcdFx0ZGF0YTtcblxuXHRcdFx0aWYodGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueSkgY29sdW1ucy5wdXNoKHRhYmxlcy5jb21wYW5pZXMuY29sdW1ucy5kZXNjcmlwdGlvbik7XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jdXN0b21lcl9uYW1lKSBjb2x1bW5zLnB1c2godGFibGVzLmNhbGxzLmNvbHVtbnMuY3VzdG9tZXJfbmFtZSk7XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0KSBjb2x1bW5zLnB1c2godGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCk7XG5cblx0XHRcdGdldENhdFByb2Nlc3Nlcyhjb2x1bW5zLCBjYXQsIHN1YmNhdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdFx0ZGF0YSA9IHJlc3VsdC5kYXRhO1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0dm0ucHJvY2Vzc2VzID0gdXRpbHMucXVlcnlUb09iamVjdChkYXRhLnJlc3VsdCwgY29sdW1ucyk7XG5cdFx0XHRcdCRtZERpYWxvZy5zaG93KHtcblx0XHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9leHBvcnQtcHJvY2Vzc2VzLmh0bWwnLFxuXHRcdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdFx0XHRcdGJlZ2luOiB2bS5iZWdpbixcblx0XHRcdFx0XHRcdGVuZDogdm0uZW5kLFxuXHRcdFx0XHRcdFx0ZGF0YTogdm0ucHJvY2Vzc2VzXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb250cm9sbGVyOiAnUHJvY2Vzc2VzRXhwb3J0Q29udHJvbGxlcicsXG5cdFx0XHRcdFx0Y29udHJvbGxlckFzOiAncHJvY0V4cFZtJyxcblx0XHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG9wZW5TZXR0aW5ncygkZXZlbnQsIGtpbmQpIHtcblx0XHRcdHZhciBkYXRhID0gdm0uZGF0YVtraW5kLm5hbWVdO1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Rhc2hib2FyZC9raW5kLXNldHRpbmdzLmh0bWwnLFxuXHRcdFx0XHRjb250cm9sbGVyOiAnS2luZFNldHRpbmdzQ29udHJvbGxlcicsXG5cdFx0XHRcdGNvbnRyb2xsZXJBczogJ2tpbmRTZXRWbScsXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdGtpbmQ6IGtpbmQsXG5cdFx0XHRcdFx0bGlzdDogZGF0YS5saXN0LFxuXHRcdFx0XHRcdHRhc2tzOiBkYXRhLnRhc2tzLFxuXHRcdFx0XHRcdGtpbmRNZXRyaWNzOiBkYXRhLm1ldHJpY3MsXG5cdFx0XHRcdFx0bWV0cmljczogZGVmYXVsdERhdGFba2luZC5uYW1lXS5tZXRyaWNzLFxuXHRcdFx0XHRcdHNsOiBkYXRhLnNsIHx8IG51bGwsXG5cdFx0XHRcdFx0ZGVmYXVsdFNMOiB2bS5vcHRpb25zLnNsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuXHRcdFx0XHRmdWxsc2NyZWVuOiB2bS51c2VyRnVsbFNjcmVlblxuXHRcdFx0fSkudGhlbihmdW5jdGlvbihvcHRzKSB7XG5cdFx0XHRcdGlmKG9wdHMuc2wpIGRhdGEuc2wgPSBvcHRzLnNsO1xuXHRcdFx0XHRkYXRhLm1ldHJpY3MgPSBvcHRzLm1ldHJpY3M7XG5cdFx0XHRcdGRhdGEubGlzdCA9IG9wdHMubGlzdDtcblxuXHRcdFx0XHQvLyBVcGRhdGUgZGF0YVxuXHRcdFx0XHR2bS5nZXRTdGF0KFtraW5kXSk7XG5cblx0XHRcdFx0Ly8gU2F2ZSBuZXcgZGF0YSB0byBzdG9yYWdlXG5cdFx0XHRcdHN0b3JlLnNldCgnZGF0YScsIHZtLmRhdGEpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhwb3J0RGFzaCgkZXZlbnQsIGtpbmRzKSB7XG5cdFx0XHQkbWREaWFsb2cuc2hvdyh7XG5cdFx0XHRcdHRhcmdldEV2ZW50OiAkZXZlbnQsXG5cdFx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2V4cG9ydC1kaWFsb2cuaHRtbCcsXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdGtpbmRzOiBraW5kcyB8fCB2bS5vcHRpb25zLmtpbmRzLFxuXHRcdFx0XHRcdGRhdGE6IHZtLmRhdGEsXG5cdFx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLmRiLnRhYmxlcyxcblx0XHRcdFx0XHRiZWdpbjogdm0uYmVnaW4sXG5cdFx0XHRcdFx0ZW5kOiB2bS5lbmQsXG5cdFx0XHRcdFx0c3RhdDogdm0uc3RhdCxcblx0XHRcdFx0XHRwcmV2c3RhdDogdm0ucHJldnN0YXQsXG5cdFx0XHRcdFx0Y2F0c3RhdDogdm0uY2F0c3RhdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb250cm9sbGVyOiAnRGFzaEV4cG9ydENvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoRXhwVm0nLFxuXHRcdFx0XHRwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcblx0XHRcdFx0ZnVsbHNjcmVlbjogdm0udXNlckZ1bGxTY3JlZW5cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERlZmF1bHREYXRhKCl7XG5cdFx0XHR2YXIgZGF0YSA9IHN0b3JlLmdldCgnZGF0YScpO1xuXHRcdFx0aWYoIWRhdGEpIHtcblx0XHRcdFx0ZGF0YSA9IGRlZmF1bHREYXRhO1xuXHRcdFx0XHRzdG9yZS5zZXQoJ2RhdGEnLCBkYXRhKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRhO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldERlZmF1bHRPcHRpb25zKCl7XG5cdFx0XHR2YXIgb3B0aW9ucyA9IHN0b3JlLmdldCgnb3B0aW9ucycpO1xuXHRcdFx0aWYoIW9wdGlvbnMpIHtcblx0XHRcdFx0b3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG9wdGlvbnM7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza3NTdGF0aXN0aWNzKHBhcmFtcywgb2JqKXtcblx0XHRcdHJldHVybiBhcGkuZ2V0VGFza0dyb3VwU3RhdGlzdGljcyhwYXJhbXMpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZhciBkYXRhID0gcmVzdWx0LmRhdGE7XG5cblx0XHRcdFx0aWYoZGF0YS5lcnJvcikgcmV0dXJuIGVycm9yU2VydmljZS5zaG93KGRhdGEuZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRcdGlmKGRhdGEucmVzdWx0Lmxlbmd0aCkgYW5ndWxhci5leHRlbmQob2JqLCBkYXRhLnJlc3VsdC5yZWR1Y2UodXRpbHMuZXh0ZW5kQW5kU3VtKSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdGF0RGF0YSh0YXNrcywga2luZCl7XG5cdFx0XHRyZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHRcdC8vIGlmKCF0YXNrcy5sZW5ndGgpIHJldHVybiByZWplY3QoKTtcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBjdXJyUGFyYW1zID0ge30sXG5cdFx0XHRcdFx0cHJldlBhcmFtcyA9IHt9LFxuXHRcdFx0XHRcdGZraW5kID0ga2luZC5uYW1lLFxuXHRcdFx0XHRcdGRhdGEgPSB2bS5kYXRhW2ZraW5kXSxcblx0XHRcdFx0XHRtZXRyaWNzID0gZGF0YS5tZXRyaWNzIHx8IHZtLmRhdGFbZmtpbmRdLm1ldHJpY3MsXG5cdFx0XHRcdFx0c2xJbmRleCA9IHV0aWxzLmdldFNsSW5kZXgobWV0cmljcyk7XG5cblx0XHRcdFx0Y3VyclBhcmFtcyA9IHtcblx0XHRcdFx0XHRiZWdpbjogbmV3IERhdGUodm0uYmVnaW4pLnZhbHVlT2YoKSxcblx0XHRcdFx0XHRlbmQ6IG5ldyBEYXRlKHZtLmVuZCkudmFsdWVPZigpLFxuXHRcdFx0XHRcdGxpc3Q6IHRhc2tzLFxuXHRcdFx0XHRcdG1ldHJpY3M6IG1ldHJpY3Ncblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZihkYXRhLnNsICYmIHNsSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0Y3VyclBhcmFtcy5tZXRyaWNzLnB1c2goJ3NsJytkYXRhLnNsKTtcblx0XHRcdFx0fSBlbHNlIGlmKGRhdGEuc2wgJiYgbWV0cmljc1tzbEluZGV4XSAhPT0gJ3NsJytkYXRhLnNsKSB7XG5cdFx0XHRcdFx0Y3VyclBhcmFtcy5tZXRyaWNzW3NsSW5kZXhdID0gJ3NsJytkYXRhLnNsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YW5ndWxhci5leHRlbmQocHJldlBhcmFtcywgY3VyclBhcmFtcyk7XG5cdFx0XHRcdHByZXZQYXJhbXMuYmVnaW4gPSBjdXJyUGFyYW1zLmJlZ2luIC0gKGN1cnJQYXJhbXMuZW5kIC0gY3VyclBhcmFtcy5iZWdpbik7XG5cdFx0XHRcdHByZXZQYXJhbXMuZW5kID0gY3VyclBhcmFtcy5iZWdpbjtcblx0XHRcdFx0XG5cdFx0XHRcdHZtLnN0YXRbZmtpbmRdID0gdGFza3MubGVuZ3RoID8gKHZtLnN0YXRbZmtpbmRdIHx8IHt9KSA6IHt9O1xuXHRcdFx0XHR2bS5wcmV2c3RhdFtma2luZF0gPSB0YXNrcy5sZW5ndGggPyAodm0ucHJldnN0YXRbZmtpbmRdIHx8IHt9KSA6IHt9O1xuXG5cdFx0XHRcdGdldFRhc2tzU3RhdGlzdGljcyhjdXJyUGFyYW1zLCB2bS5zdGF0W2ZraW5kXSkudGhlbihmdW5jdGlvbigpe1xuXHRcdFx0XHRcdHJldHVybiBnZXRUYXNrc1N0YXRpc3RpY3MocHJldlBhcmFtcywgdm0ucHJldnN0YXRbZmtpbmRdKTtcblx0XHRcdFx0fSkudGhlbihmdW5jdGlvbigpe1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNhdmUgYXJyYXkgb2YgdGFza3MgdG8gc2NvcGUgdmFyaWFibGVzXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdCAtIG9iamVjdCwgd2hpY2ggaXMgcmV0dXJuZWQgZnJvbSBnZXRUYXNrcyBxdWVyeSBvciBhbiBhcnJheSBvZiB0YXNrc1xuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldFRhc2tzKHJlc3VsdCwga2luZCl7XG5cdFx0XHR2YXIgZGF0YSA9IHJlc3VsdC5kYXRhLFxuXHRcdFx0XHR0YXNrcyA9IGRhdGEgPyBkYXRhLnJlc3VsdCA6IHJlc3VsdCxcblx0XHRcdFx0ZmtpbmQgPSBraW5kLm5hbWU7XG5cblx0XHRcdHJldHVybiAkcShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0aWYoZGF0YSAmJiBkYXRhLmVycikgcmV0dXJuIHJlamVjdChkYXRhLmVyci5tZXNzYWdlKTtcblx0XHRcdFx0aWYoIXRhc2tzKSByZXR1cm4gcmVqZWN0KCdUYXNrcyBpcyB1bmRlZmluZWQnKTtcblxuXHRcdFx0XHRpZighdm0uZGF0YVtma2luZF0pIHtcblx0XHRcdFx0XHR2bS5kYXRhW2ZraW5kXSA9IGRlZmF1bHREYXRhLmRlZmF1bHRzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZtLmRhdGFbZmtpbmRdLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHRcdFx0aWYoIXZtLmRhdGFbZmtpbmRdLmxpc3QubGVuZ3RoKSB2bS5kYXRhW2ZraW5kXS5saXN0ID0gW10uY29uY2F0KHRhc2tzKTtcblxuXHRcdFx0XHRyZXNvbHZlKHRhc2tzKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhdGVnb3JpZXNTdGF0KCl7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsXG5cdFx0XHRtZXRyaWNzID0gWyduY2EnLCAnYXR0JywgJ2FodCcsICdhc2EnLCAnc2wnK3ZtLmRhdGEuSW5jb21pbmdfQWdlbnQuc2xdO1xuXHRcdFx0XG5cdFx0XHRpZih0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0KSB7XG5cdFx0XHRcdG1ldHJpY3MucHVzaCgnc3VtKGNhbGxyZXN1bHQpJyk7XG5cdFx0XHRcdC8vIHZtLmNhdE1ldHJpY3MucHVzaCh7IGluZGV4OiAnc3VtKGNhbGxyZXN1bHQpJywgbmFtZTogJ0NhbGwgcmVzb2x1dGlvbicgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHZtLm9wdGlvbnMudGFibGVzTGlzdCA9IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZV07XG5cdFx0XHRpZih0YWJsZXMuY29tcGFuaWVzKSB2bS5vcHRpb25zLnRhYmxlc0xpc3QucHVzaCh0YWJsZXMuY29tcGFuaWVzLm5hbWUpO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0YXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0Ly8gdGFibGVzOiBbJ3Byb2JzdGF0JywgJ3Byb2JjYXQnLCAncHJvYmNvbXBhbnknXSxcblx0XHRcdFx0dGFibGVzOiB2bS5vcHRpb25zLnRhYmxlc0xpc3QsXG5cdFx0XHRcdC8vIHRhYnJlbDogJ3Byb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrXG5cdFx0XHRcdFx0XHQvLyAnIGFuZCB0YXNrdHlwZSBpbiAoJytnZXRUYXNrS2luZHMoKS5qb2luKCcsJykrJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgdGFza2lkIGluIChcXCcnK2dldFRhc2tJZHMoKS5qb2luKCdcXCcsXFwnJykrJ1xcJyknK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLm9wZXJhdG9yXS5qb2luKCcuJykrJz1wcm9jZXNzZWQuYWdlbnRpZCcrXG5cdFx0XHRcdFx0XHQodGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueSA/XG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuY29tcGFueV0uam9pbignLicpKyc9JytbdGFibGVzLmNvbXBhbmllcy5uYW1lLCB0YWJsZXMuY29tcGFuaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSA6XG5cdFx0XHRcdFx0XHQnJyksXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdC8vIGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0XHRkYXRhID0gcmVzdWx0LmRhdGE7XG5cdFx0XHRcdGlmKCFkYXRhLnJlc3VsdC5sZW5ndGgpIHJldHVybiBzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0XHRpZihkYXRhLmVycm9yKSByZXR1cm4gZXJyb3JTZXJ2aWNlLnNob3coZGF0YS5lcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0XG5cdFx0XHRcdC8vIHZtLmNhdFRvdGFscyA9IGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpO1xuXHRcdFx0XHR2bS5jYXRzdGF0ID0gc2V0Q2F0c1N0YXQoZGF0YS5yZXN1bHQsIGRhdGEucmVzdWx0LnJlZHVjZSh1dGlscy5nZXRUb3RhbHMpKTtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRDYXRlZ29yaWVzU3RhdCBjYXRzdGF0OiAnLCB2bS5jYXRzdGF0KTtcblx0XHRcdFx0dm0uY2F0Y2hhcnREYXRhID0gc2V0Q2F0Y2hhcnREYXRhKHZtLmNhdHN0YXQsIHZtLmNhdGNoYXJ0TGFiZWwsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuZGVzY3JpcHRpb24pO1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0fSlcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRTdWJDYXRlZ29yaWVzU3RhdChjYXQpe1xuXHRcdFx0dmFyIGRhdGEsIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLFxuXHRcdFx0bWV0cmljcyA9IFsnbmNhJywgJ2F0dCcsICdhaHQnLCAnYXNhJywgJ3NsJyt2bS5kYXRhLkluY29taW5nX0FnZW50LnNsXTtcblx0XHRcdGlmKHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHQpIG1ldHJpY3MucHVzaCgnc3VtKGNhbGxyZXN1bHQpJyk7XG5cblx0XHRcdHNwaW5uZXJTZXJ2aWNlLnNob3coJ2NhdGVnb3JpZXMtbG9hZGVyJyk7XG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0Ly8gdGFibGVzOiBbJ3Byb2JzdGF0JywgJ3Byb2JjYXQnLCAncHJvYmRldGFpbHMnXSxcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWVdLFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9iY2F0LmNhdGRlc2M9XCInK2NhdCsnXCIgYW5kIHByb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmRldGFpbHM9cHJvYmRldGFpbHMuc3ViaWQnLFxuXHRcdFx0XHR0YWJyZWw6IFt0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrJz0nK2NhdCtcblx0XHRcdFx0XHRcdC8vICcgYW5kIHRhc2t0eXBlIGluICgnK2dldFRhc2tLaW5kcygpLmpvaW4oJywnKSsnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeV0uam9pbignLicpKyc9JytbdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLnN1YmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuc3ViY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJyksXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmlkLCB0YWJsZXMuc3ViY2F0ZWdvcmllcy5jb2x1bW5zLmRlc2NyaXB0aW9uXSxcblx0XHRcdFx0YmVnaW46IHZtLmJlZ2luLnZhbHVlT2YoKSxcblx0XHRcdFx0ZW5kOiB2bS5lbmQudmFsdWVPZigpLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0U3ViQ2F0ZWdvcmllc1N0YXQgZGF0YTogJywgcmVzdWx0LmRhdGEpO1xuXHRcdFx0XHRzcGlubmVyU2VydmljZS5oaWRlKCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0UHJvY2Vzc2VzKGNvbHVtbnMsIGNhdCwgc3ViY2F0KXtcblx0XHRcdGlmKCFjb2x1bW5zKSByZXR1cm47XG5cdFx0XHR2YXIgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXM7XG5cdFx0XHR2bS5vcHRpb25zLnRhYmxlc0xpc3QgPSBbdGFibGVzLnByb2Nlc3NlZC5uYW1lLCB0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZV07XG5cdFx0XHRpZih0YWJsZXMuY29tcGFuaWVzKSB2bS5vcHRpb25zLnRhYmxlc0xpc3QucHVzaCh0YWJsZXMuY29tcGFuaWVzLm5hbWUpO1xuXG5cdFx0XHRzcGlubmVyU2VydmljZS5zaG93KCdjYXRlZ29yaWVzLWxvYWRlcicpO1xuXHRcdFx0cmV0dXJuIGFwaS5nZXRRdWVyeVJlc3VsdFNldCh7XG5cdFx0XHRcdC8vIHRhYmxlczogWydwcm9jZXNzZWQnLCAncHJvYnN0YXQnLCAncHJvYmNhdCcsICdwcm9iZGV0YWlscycsICdwcm9iY29tcGFueSddLFxuXHRcdFx0XHR0YWJsZXM6IHZtLm9wdGlvbnMudGFibGVzTGlzdCxcblx0XHRcdFx0Ly8gdGFicmVsOiAoY2F0ID8gJ3Byb2JjYXQuY2F0ZGVzYz1cIicrY2F0KydcIiBhbmQgJyA6ICcnKSArIChzdWJjYXQgPyAncHJvYmRldGFpbHMucHJvYmRlc2M9XCInK3N1YmNhdCsnXCIgYW5kICcgOiAnJykgKyAncHJvYnN0YXQucHJvYmNhdD1wcm9iY2F0LmNhdGlkIGFuZCBwcm9ic3RhdC5wcm9iZGV0YWlscz1wcm9iZGV0YWlscy5zdWJpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiAoY2F0ID8gW3RhYmxlcy5jYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5jYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSsnPScrY2F0KycgYW5kICcgOiAnJykgK1xuXHRcdFx0XHRcdFx0JyB0YXNraWQgaW4gKFxcJycrZ2V0VGFza0lkcygpLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLmpvaW4oJy4nKSsnPXByb2Nlc3NlZC5hZ2VudGlkICcrXG5cdFx0XHRcdFx0XHQoc3ViY2F0ID8gJyBhbmQgJytbdGFibGVzLnN1YmNhdGVnb3JpZXMubmFtZSwgdGFibGVzLnN1YmNhdGVnb3JpZXMuY29sdW1ucy5pZF0uam9pbignLicpKyc9JytzdWJjYXQgOiAnJykgK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhdGVnb3J5XS5qb2luKCcuJykrJz0nK1t0YWJsZXMuY2F0ZWdvcmllcy5uYW1lLCB0YWJsZXMuY2F0ZWdvcmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykrXG5cdFx0XHRcdFx0XHQodGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnkgPyAnIGFuZCAnK1t0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMuc3ViY2F0ZWdvcnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5zdWJjYXRlZ29yaWVzLm5hbWUsIHRhYmxlcy5zdWJjYXRlZ29yaWVzLmNvbHVtbnMuaWRdLmpvaW4oJy4nKSA6ICcnKStcblx0XHRcdFx0XHRcdCh0YWJsZXMuY2FsbHMuY29sdW1ucy5jb21wYW55ID8gJyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbXBhbnldLmpvaW4oJy4nKSsnPScrW3RhYmxlcy5jb21wYW5pZXMubmFtZSwgdGFibGVzLmNvbXBhbmllcy5jb2x1bW5zLmlkXS5qb2luKCcuJykgOiAnJyksXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IGNvbHVtbnMsXG5cdFx0XHRcdC8vIGdyb3VwQnk6IHRhYmxlcy5jYWxscy5jb2x1bW5zLmNvbW1lbnRzLFxuXHRcdFx0XHRiZWdpbjogdm0uYmVnaW4udmFsdWVPZigpLFxuXHRcdFx0XHRlbmQ6IHZtLmVuZC52YWx1ZU9mKClcblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcblx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnY2F0ZWdvcmllcy1sb2FkZXInKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhbGxSZXNvbHV0aW9uU3RhdCgpe1xuXHRcdFx0dmFyIGRhdGEsIHRhYmxlcyA9IHZtLm9wdGlvbnMuZGIudGFibGVzLCB0YXNrS2luZCA9IDEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudChjYWxscmVzdWx0KSddO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHQvLyB0YWJyZWw6ICdwcm9ic3RhdC5wcm9iY2F0PXByb2JjYXQuY2F0aWQgYW5kIHByb2JzdGF0LnByb2Jjb21wYW55PXByb2Jjb21wYW55LmNvbXBpZCcsXG5cdFx0XHRcdHRhYnJlbDogJ3Rhc2tpZCBpbiAoXFwnJytnZXRUYXNrSWRzKFt0YXNrS2luZF0pLmpvaW4oJ1xcJyxcXCcnKSsnXFwnKScrXG5cdFx0XHRcdFx0XHQnYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxscmVzdWx0XS5qb2luKCcuJykrJyA9IDEnLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdF0sXG5cdFx0XHRcdC8vIGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldENhbGxSZXNvbHV0aW9uU3RhdCBkYXRhOiAnLCByZXN1bHQuZGF0YSk7XG5cdFx0XHRcdGlmKHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdFx0XHR2bS5nbG9iYWxDclt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSA9IHJlc3VsdC5kYXRhLnJlc3VsdFswXVsnY291bnQoY2FsbHJlc3VsdCknXTtcblx0XHRcdFx0XHRkZWJ1Zy5sb2coJ2dsb2JhbENyOiAnLCB2bS5nbG9iYWxDclt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSk7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0TG9naW5zUmF0aW8oKSB7XG5cdFx0XHR2YXIgZGF0YSwgdGFibGVzID0gdm0ub3B0aW9ucy5kYi50YWJsZXMsIHRhc2tLaW5kID0gMSxcblx0XHRcdHJkYXRhID0ge30sXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudChjYXNlIHdoZW4gcHJvYmNhdCAhPSAwIHRoZW4gcHJvYmNhdCBlbHNlIG51bGwgZW5kKSBhcyB0bG9naW5zJ107XG5cblx0XHRcdHJldHVybiBhcGkuZ2V0Q3VzdG9tTGlzdFN0YXRpc3RpY3Moe1xuXHRcdFx0XHR0YWJsZXM6IFt0YWJsZXMuY2FsbHMubmFtZV0sXG5cdFx0XHRcdC8vIHRhYnJlbDogJ3Byb2JzdGF0LnByb2JjYXQ9cHJvYmNhdC5jYXRpZCBhbmQgcHJvYnN0YXQucHJvYmNvbXBhbnk9cHJvYmNvbXBhbnkuY29tcGlkJyxcblx0XHRcdFx0dGFicmVsOiAndGFza2lkIGluIChcXCcnK2dldFRhc2tJZHMoW3Rhc2tLaW5kXSkuam9pbignXFwnLFxcJycpKydcXCcpJyxcblx0XHRcdFx0XHRcdC8vICdhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKSsnID0gMScsXG5cdFx0XHRcdHByb2NpZDogW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5wcm9jZXNzX2lkXS5qb2luKCcuJyksXG5cdFx0XHRcdGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5sb2dpbl0sXG5cdFx0XHRcdC8vIGNvbHVtbnM6IFt0YWJsZXMuY2FsbHMuY29sdW1ucy5jYXRlZ29yeSwgdGFibGVzLmNhdGVnb3JpZXMuY29sdW1ucy5kZXNjcmlwdGlvbl0sXG5cdFx0XHRcdGJlZ2luOiB2bS5iZWdpbi52YWx1ZU9mKCksXG5cdFx0XHRcdGVuZDogdm0uZW5kLnZhbHVlT2YoKSxcblx0XHRcdFx0bWV0cmljczogbWV0cmljc1xuXHRcdFx0fSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ2dldExvZ2luc1JhdGlvIGRhdGE6ICcsIHJlc3VsdC5kYXRhKTtcblx0XHRcdFx0aWYocmVzdWx0LmRhdGEgJiYgcmVzdWx0LmRhdGEucmVzdWx0ICYmIHJlc3VsdC5kYXRhLnJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZGF0YSA9IHJlc3VsdC5kYXRhLnJlc3VsdFswXTtcblx0XHRcdFx0XHR2bS5zdGF0ID0gdm0uc3RhdCB8fCB7fTtcblx0XHRcdFx0XHR2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldID0gdm0uc3RhdFt1dGlscy5nZXRGcmllbmRseUtpbmQodGFza0tpbmQpXSB8fCB7fTtcblx0XHRcdFx0XHR2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldLm5jdSA9IHJkYXRhLnRsb2dpbnM7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0ZGVidWcubG9nKCdnZXRMb2dpbnNSYXRpbyBzdGF0OiAnLCB2bS5zdGF0W3V0aWxzLmdldEZyaWVuZGx5S2luZCh0YXNrS2luZCldKTtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZXRDYXRzU3RhdChkYXRhLCB0b3RhbHMpe1xuXHRcdFx0dmFyIGRhdGFWYWx1ZTtcblx0XHRcdFx0Ly8gdG90YWxzID0gZGF0YS5yZWR1Y2UodXRpbHMuZ2V0VG90YWxzKTtcblxuXHRcdFx0cmV0dXJuIHV0aWxzLnNldFBlcmNlbnRhZ2VWYWx1ZXMoZGF0YSwgdG90YWxzKS5tYXAoZnVuY3Rpb24oaXRlbSl7XG5cdFx0XHRcdGFuZ3VsYXIuZm9yRWFjaChpdGVtLCBmdW5jdGlvbih2YWx1ZSwga2V5KXtcblx0XHRcdFx0XHRkYXRhVmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKTtcblxuXHRcdFx0XHRcdGlmKCFpc05hTihkYXRhVmFsdWUpKSBpdGVtW2tleV0gPSBkYXRhVmFsdWU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNldENhdGNoYXJ0RGF0YShhcnJheSwgZGF0YWtleSwgbGFiZWxrZXkpe1xuXHRcdFx0dmFyIG5ld0FycmF5ID0gW10sIGRhdGEgPSBbXSwgbGFiZWxzID0gW10sIGNvbG91cnMgPSBbXSwgaXRlbURhdGE7XG5cblx0XHRcdHNvcnRPYmpCeShhcnJheSwgZGF0YWtleSwgJ2Rlc2NlbmQnKVxuXHRcdFx0Lm1hcChmdW5jdGlvbihpdGVtKXtcblx0XHRcdFx0ZGF0YS5wdXNoKGFuZ3VsYXIuaXNOdW1iZXIoaXRlbVtkYXRha2V5XSkgPyBpdGVtW2RhdGFrZXldLnRvRml4ZWQoMikgOiBpdGVtW2RhdGFrZXldICk7XG5cdFx0XHRcdGxhYmVscy5wdXNoKGl0ZW1bbGFiZWxrZXldKTtcblx0XHRcdFx0Y29sb3Vycy5wdXNoKGdldENhdGVnb3J5Q29sb3VyKGl0ZW1bbGFiZWxrZXldKSk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHRzdG9yZS5zZXQoJ29wdGlvbnMnLCB2bS5vcHRpb25zKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZGF0YTogZGF0YSxcblx0XHRcdFx0bGFiZWxzOiBsYWJlbHMsXG5cdFx0XHRcdGNvbG91cnM6IGNvbG91cnNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0Q2F0ZWdvcnlDb2xvdXIoY2F0KXtcblx0XHRcdHZhciBjYXRDb2xvdXJzID0gdm0ub3B0aW9ucy5jYXRDb2xvdXJzLFxuXHRcdFx0XHRmb3VuZCA9IGZhbHNlLCBjb2xvdXIgPSAnJztcblxuXHRcdFx0Y2F0Q29sb3Vycy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pe1xuXHRcdFx0XHRpZihpdGVtLm5hbWUgPT09IGNhdCkgZm91bmQgPSBpdGVtO1xuXHRcdFx0fSk7XG5cblx0XHRcdGlmKGZvdW5kKSB7XG5cdFx0XHRcdGNvbG91ciA9IGZvdW5kLmNvbG91cjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbG91ciA9IGNvbG91ckdlbmVyYXRvci5nZXRDb2xvcigpO1xuXHRcdFx0XHR2bS5vcHRpb25zLmNhdENvbG91cnMucHVzaCh7IG5hbWU6IGNhdCwgY29sb3VyOiBjb2xvdXIgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY29sb3VyO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNvcnRPYmpCeShhcnJheSwga2V5LCBkZXNjZW5kKXtcblx0XHRcdHZhciBzb3J0ZWQgPSBhcnJheS5zb3J0KGZ1bmN0aW9uKGEsIGIpe1xuXHRcdFx0XHRpZihhW2tleV0gPiBiW2tleV0pIHJldHVybiBkZXNjZW5kID8gLTEgOiAxO1xuXHRcdFx0XHRpZihhW2tleV0gPCBiW2tleV0pIHJldHVybiBkZXNjZW5kID8gMSA6IC0xO1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHNvcnRlZDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRUYXNrS2luZHMoKXtcblx0XHRcdHJldHVybiB2bS5vcHRpb25zLmtpbmRzLm1hcChmdW5jdGlvbihpdGVtKXsgcmV0dXJuIGl0ZW0ua2luZDsgfSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0VGFza0lkcyhraW5kcyl7XG5cdFx0XHR2YXIgaWRzID0gW107XG5cdFx0XHRhbmd1bGFyLmZvckVhY2godm0uZGF0YSwgZnVuY3Rpb24odmFsdWUsIGtleSl7XG5cdFx0XHRcdGlmKHZhbHVlLmxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYoa2luZHMpIHtcblx0XHRcdFx0XHRcdGlmKGtpbmRzLmluZGV4T2YodmFsdWUua2luZCkgPiAtMSkgaWRzLnB1c2godmFsdWUubGlzdCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlkcy5wdXNoKHZhbHVlLmxpc3QpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmKGlkcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGlkcy5yZWR1Y2UoZnVuY3Rpb24ocHJldiwgY3Vycil7XG5cdFx0XHRcdFx0cmV0dXJuIHByZXYuY29uY2F0KGN1cnIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBpZHM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxufSkoKTsiLCJhbmd1bGFyLm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG4uY29uZmlnKFsnJHJvdXRlUHJvdmlkZXInLCBmdW5jdGlvbigkcm91dGVQcm92aWRlcil7XG5cblx0JHJvdXRlUHJvdmlkZXIuXG5cdFx0d2hlbignL2Rhc2hib2FyZCcsIHtcblx0XHRcdHRlbXBsYXRlVXJsOiAnZGFzaGJvYXJkL2Rhc2hib2FyZC5odG1sJyxcblx0XHRcdGNvbnRyb2xsZXI6ICdEYXNoQ29udHJvbGxlcicsXG5cdFx0XHRjb250cm9sbGVyQXM6ICdkYXNoVm0nXG5cdFx0fSk7XG59XSk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuY29udHJvbGxlcignS2luZFNldHRpbmdzQ29udHJvbGxlcicsIEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIpO1xuXG5cdEtpbmRTZXR0aW5nc0NvbnRyb2xsZXIuJGluamVjdCA9IFsnJHNjb3BlJywgJyRtZERpYWxvZycsICdraW5kJywgJ2xpc3QnLCAndGFza3MnLCAna2luZE1ldHJpY3MnLCAnbWV0cmljcycsICdzbCcsICdkZWZhdWx0U0wnXTtcblxuXHRmdW5jdGlvbiBLaW5kU2V0dGluZ3NDb250cm9sbGVyKCRzY29wZSwgJG1kRGlhbG9nLCBraW5kLCBsaXN0LCB0YXNrcywga2luZE1ldHJpY3MsIG1ldHJpY3MsIHNsLCBkZWZhdWx0U0wpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHR2bS5raW5kID0ga2luZDtcblx0XHR2bS5saXN0ID0gW10uY29uY2F0KGxpc3QpO1xuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKS5zb3J0KCk7XG5cdFx0dm0ua2luZE1ldHJpY3MgPSBbXS5jb25jYXQoa2luZE1ldHJpY3MpO1xuXHRcdHZtLm1ldHJpY3MgPSBbXS5jb25jYXQobWV0cmljcyk7XG5cdFx0dm0uc2wgPSBzbDtcblx0XHR2bS5kZWZhdWx0U0wgPSBkZWZhdWx0U0w7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0dm0uc2F2ZSA9IHNhdmU7XG5cdFx0dm0uY2xvc2UgPSBjbG9zZVNldHRpbmdzO1xuXHRcdHZtLnRvZ2dsZSA9IHRvZ2dsZTtcblx0XHR2bS5leGlzdHMgPSBleGlzdHM7XG5cdFx0dm0uc2VsZWN0QWxsVGFza3MgPSBzZWxlY3RBbGxUYXNrcztcblxuXHRcdCRzY29wZS4kd2F0Y2goZnVuY3Rpb24oKXtcblx0XHRcdHJldHVybiB2bS5saXN0Lmxlbmd0aDtcblx0XHR9LCBmdW5jdGlvbih2YWwpe1xuXHRcdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9IHZtLmxpc3QubGVuZ3RoID09PSB2bS50YXNrcy5sZW5ndGg7XG5cdFx0fSk7XG5cblx0XHRmdW5jdGlvbiBzYXZlKCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ2tpbmQgc2V0dHM6Jywgdm0ubGlzdCk7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNsOiB2bS5zbCxcblx0XHRcdFx0bWV0cmljczogdm0ua2luZE1ldHJpY3MsXG5cdFx0XHRcdGxpc3Q6IHZtLmxpc3Rcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHNlbGVjdEFsbFRhc2tzKCkge1xuXHRcdFx0aWYodm0uYWxsVGFza3NTZWxlY3RlZCkgdm0ubGlzdCA9IFtdLmNvbmNhdCh0YXNrcyk7XG5cdFx0XHRlbHNlIHZtLmxpc3QgPSBbXTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9zZVNldHRpbmdzKCkge1xuXHRcdFx0JG1kRGlhbG9nLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gbGlzdC5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0aWYgKGlkeCA+IC0xKSBsaXN0LnNwbGljZShpZHgsIDEpO1xuXHRcdFx0ZWxzZSBsaXN0LnB1c2goaXRlbSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZXhpc3RzKGl0ZW0sIGxpc3QpIHtcblx0XHRcdHJldHVybiBsaXN0LmluZGV4T2YoaXRlbSkgPiAtMTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmRhc2hib2FyZCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1Byb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXInLCBQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyKTtcblxuXHRQcm9jZXNzZXNFeHBvcnRDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckZmlsdGVyJywgJyRtZERpYWxvZycsICd0YWJsZXMnLCAnYmVnaW4nLCAnZW5kJywgJ2RhdGEnLCAndXRpbHNTZXJ2aWNlJywgJ2RlYnVnU2VydmljZSddO1xuXG5cdGZ1bmN0aW9uIFByb2Nlc3Nlc0V4cG9ydENvbnRyb2xsZXIoJHNjb3BlLCAkZmlsdGVyLCAkbWREaWFsb2csIHRhYmxlcywgYmVnaW4sIGVuZCwgZGF0YSwgdXRpbHMsIGRlYnVnKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0dm0udGFibGVzID0gdGFibGVzO1xuXHRcdHZtLmJlZ2luID0gYmVnaW47XG5cdFx0dm0uZW5kID0gZW5kO1xuXHRcdHZtLmRhdGEgPSBkYXRhO1xuXG5cdFx0dm0ub3JkZXIgPSB0YWJsZXMuY2FsbHMuY29sdW1ucy5jYWxsZGF0ZSxcblx0XHR2bS5zZWFyY2ggPSAnJztcblx0XHR2bS5maWx0ZXIgPSB7XG5cdFx0XHRjYWxscmVzdWx0OiAnJ1xuXHRcdH07XG5cblx0XHR2bS5leHBvcnROYW1lID0gJ3Byb2Nlc3Nlcyc7XG5cdFx0Ly8gdm0uZXhwb3J0TmFtZSA9ICRmaWx0ZXIoJ2RhdGUnKSh2bS5iZWdpbiwgJ2RkLk1NLnl5JykgKyAnLScgKyAkZmlsdGVyKCdkYXRlJykodm0uZW5kLCAnZGQuTU0ueXknKTtcblxuXHRcdHZtLmNsb3NlID0gZnVuY3Rpb24oKXtcblx0XHRcdCRtZERpYWxvZy5oaWRlKCk7XG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuZGFzaGJvYXJkJylcblx0XHQuZGlyZWN0aXZlKCdzdGF0Q2FyZCcsIHN0YXRDYXJkKTtcblxuXHRmdW5jdGlvbiBzdGF0Q2FyZCgpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0cmVwbGFjZTogdHJ1ZSxcblx0XHRcdHNjb3BlOiB7XG5cdFx0XHRcdG1vZGVsOiAnQCcsXG5cdFx0XHRcdHRpdGxlOiAnQCcsXG5cdFx0XHRcdHN1YmhlYWQ6ICdAJyxcblx0XHRcdFx0cHJldnN0YXQ6ICdAJyxcblx0XHRcdFx0ZHluYW1pY3M6ICdAJyxcblx0XHRcdFx0Y2FyZENsYXNzOiAnQCcsXG5cdFx0XHRcdGZsZXhWYWx1ZTogJ0AnXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGVVcmw6ICdhc3NldHMvcGFydGlhbHMvY2FyZC5odG1sJ1xuXHRcdH07XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmNycicpXG5cdFx0LmNvbnRyb2xsZXIoJ0NyclNldHRpbmdzQ29udHJvbGxlcicsIENyclNldHRpbmdzQ29udHJvbGxlcik7XG5cblx0Q3JyU2V0dGluZ3NDb250cm9sbGVyLiRpbmplY3QgPSBbJyRzY29wZScsICckbWREaWFsb2cnLCAndGFza3MnLCAnc2VsZWN0ZWRUYXNrcycsICdkZWJ1Z1NlcnZpY2UnXTtcblxuXHRmdW5jdGlvbiBDcnJTZXR0aW5nc0NvbnRyb2xsZXIoJHNjb3BlLCAkbWREaWFsb2csIHRhc2tzLCBzZWxlY3RlZFRhc2tzLCBkZWJ1Zykge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLnRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHR2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHNlbGVjdGVkVGFza3MpO1xuXHRcdHZtLnNlbGVjdEFsbFRhc2tzID0gc2VsZWN0QWxsVGFza3M7XG5cdFx0dm0uYWxsVGFza3NTZWxlY3RlZCA9ICh0YXNrcy5sZW5ndGggPT09IHNlbGVjdGVkVGFza3MubGVuZ3RoKTtcblx0XHR2bS5zYXZlID0gc2F2ZTtcblx0XHR2bS5jbG9zZSA9IGNsb3NlU2V0dGluZ3M7XG5cdFx0dm0udG9nZ2xlID0gdG9nZ2xlO1xuXHRcdHZtLmluZGV4ID0gaW5kZXg7XG5cdFx0dm0uZXhpc3RzID0gZXhpc3RzO1xuXG5cdFx0JHNjb3BlLiR3YXRjaChmdW5jdGlvbigpe1xuXHRcdFx0cmV0dXJuIHZtLnNlbGVjdGVkVGFza3MubGVuZ3RoO1xuXHRcdH0sIGZ1bmN0aW9uKHZhbCl7XG5cdFx0XHR2bS5hbGxUYXNrc1NlbGVjdGVkID0gdm0uc2VsZWN0ZWRUYXNrcy5sZW5ndGggPT09IHZtLnRhc2tzLmxlbmd0aDtcblx0XHR9KTtcblxuXHRcdGRlYnVnLmxvZygndGFza3NtIHNlbGVjdGVkVGFza3M6ICcsIHZtLnRhc2tzLCB2bS5zZWxlY3RlZFRhc2tzKTtcblxuXHRcdGZ1bmN0aW9uIHNhdmUoKSB7XG5cdFx0XHQkbWREaWFsb2cuaGlkZSh7XG5cdFx0XHRcdHNlbGVjdGVkVGFza3M6IHZtLnNlbGVjdGVkVGFza3Ncblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGNsb3NlU2V0dGluZ3MoKSB7XG5cdFx0XHQkbWREaWFsb2cuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc2VsZWN0QWxsVGFza3MoKSB7XG5cdFx0XHRpZih2bS5hbGxUYXNrc1NlbGVjdGVkKSB2bS5zZWxlY3RlZFRhc2tzID0gW10uY29uY2F0KHRhc2tzKTtcblx0XHRcdGVsc2Ugdm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRvZ2dsZShpdGVtLCBsaXN0KSB7XG5cdFx0XHR2YXIgaWR4ID0gaW5kZXgoaXRlbSwgbGlzdCk7XG5cdFx0XHRpZiAoaWR4ICE9PSAtMSkgbGlzdC5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdGVsc2UgbGlzdC5wdXNoKGl0ZW0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGluZGV4KGl0ZW0sIGxpc3QpIHtcblx0XHRcdHZhciBpZHggPSAtMTtcblx0XHRcdGxpc3QuZm9yRWFjaChmdW5jdGlvbihsaXN0SXRlbSwgaW5kZXgpe1xuXHRcdFx0XHRpZihsaXN0SXRlbSA9PSBpdGVtKSBpZHggPSBpbmRleDtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGlkeDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleGlzdHMoaXRlbSwgbGlzdCkge1xuXHRcdFx0cmV0dXJuIGxpc3QuaW5kZXhPZihpdGVtKSA+IC0xO1xuXHRcdH1cblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAuY3JyJylcblx0XHQuY29udHJvbGxlcignQ3JyQ29udHJvbGxlcicsIENyckNvbnRyb2xsZXIpO1xuXG5cdENyckNvbnRyb2xsZXIuJGluamVjdCA9IFsnJHJvb3RTY29wZScsICckbWREaWFsb2cnLCAnU2V0dGluZ3NTZXJ2aWNlJywgJ2FwaVNlcnZpY2UnLCAnVGFza3NTZXJ2aWNlJywgJ3V0aWxzU2VydmljZScsICdkZWJ1Z1NlcnZpY2UnLCAnc3Bpbm5lclNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cblx0ZnVuY3Rpb24gQ3JyQ29udHJvbGxlcigkcm9vdFNjb3BlLCAkbWREaWFsb2csIFNldHRpbmdzU2VydmljZSwgYXBpLCBUYXNrc1NlcnZpY2UsIHV0aWxzLCBkZWJ1Zywgc3Bpbm5lclNlcnZpY2UsIGVycm9yU2VydmljZSkge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblx0XHR2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG5cdFx0XHRwZXJpb2Q6ICcxIHllYXInXG5cdFx0fTtcblx0XHR2YXIgcGVyZlN0YXQgPSBbXTtcblx0XHR2YXIgYWdlbnRTdGF0ID0gW107XG5cblx0XHR2bS5zZXR0aW5ncyA9IHt9O1xuXHRcdHZtLnRhc2tzID0gW107XG5cdFx0dm0uc2VsZWN0ZWRUYXNrcyA9IFtdO1xuXHRcdHZtLnN0YXQgPSBbXTtcblx0XHR2bS5iZWdpbiA9IHV0aWxzLnBlcmlvZFRvUmFuZ2UoZGVmYXVsdE9wdGlvbnMucGVyaW9kKS5iZWdpbjtcblx0XHR2bS5lbmQgPSB1dGlscy5wZXJpb2RUb1JhbmdlKGRlZmF1bHRPcHRpb25zLnBlcmlvZCkuZW5kO1xuXHRcdHZtLmdldENhbGxSZXNvbHV0aW9uID0gZ2V0Q2FsbFJlc29sdXRpb247XG5cdFx0dm0ub3BlblNldHRpbmdzID0gb3BlblNldHRpbmdzO1xuXHRcdHZtLnRhYmxlU29ydCA9ICctcGVyZic7XG5cblx0XHRpbml0KCk7XG5cdFx0c3Bpbm5lclNlcnZpY2UuaGlkZSgnbWFpbi1sb2FkZXInKTtcblxuXHRcdGZ1bmN0aW9uIGluaXQoKSB7XG5cdFx0XHRTZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3MoKVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG5cdFx0XHRcdHZtLnNldHRpbmdzID0gZGJTZXR0aW5ncztcblx0XHRcdFx0cmV0dXJuIFRhc2tzU2VydmljZS5nZXRUYXNrTGlzdCgxKTtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihmdW5jdGlvbih0YXNrcykge1xuXHRcdFx0XHRkZWJ1Zy5sb2coJ3Rhc2tzOiAnLCB0YXNrcy5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdHZtLnRhc2tzID0gdGFza3MuZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSB0YXNrcy5kYXRhLnJlc3VsdDtcblx0XHRcdH0pXG5cdFx0XHQudGhlbihnZXRDYWxsUmVzb2x1dGlvbilcblx0XHRcdC5jYXRjaChlcnJvclNlcnZpY2Uuc2hvdyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gb3BlblNldHRpbmdzKCRldmVudCkge1xuXHRcdFx0JG1kRGlhbG9nLnNob3coe1xuXHRcdFx0XHR0YXJnZXRFdmVudDogJGV2ZW50LFxuXHRcdFx0XHR0ZW1wbGF0ZVVybDogJ2Nyci9jcnItc2V0dGluZ3MuaHRtbCcsXG5cdFx0XHRcdGNvbnRyb2xsZXI6ICdDcnJTZXR0aW5nc0NvbnRyb2xsZXInLFxuXHRcdFx0XHRjb250cm9sbGVyQXM6ICdjcnJTZXR0c1ZtJyxcblx0XHRcdFx0cGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG5cdFx0XHRcdGxvY2Fsczoge1xuXHRcdFx0XHRcdHRhc2tzOiB2bS50YXNrcyxcblx0XHRcdFx0XHRzZWxlY3RlZFRhc2tzOiB2bS5zZWxlY3RlZFRhc2tzXG5cdFx0XHRcdH1cblx0XHRcdH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG5cdFx0XHRcdHZtLnNlbGVjdGVkVGFza3MgPSByZXN1bHQuc2VsZWN0ZWRUYXNrcztcblx0XHRcdFx0Z2V0Q2FsbFJlc29sdXRpb24oKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldENhbGxSZXNvbHV0aW9uKCkge1xuXHRcdFx0c3Bpbm5lclNlcnZpY2Uuc2hvdygnY3JyLWxvYWRlcicpO1xuXG5cdFx0XHRyZXR1cm4gZ2V0QWdlbnRzU3RhdCh2bS5zZXR0aW5ncy50YWJsZXMsIHZtLmJlZ2luLnZhbHVlT2YoKSwgdm0uZW5kLnZhbHVlT2YoKSlcblx0XHRcdC50aGVuKGZ1bmN0aW9uKGFzdGF0KSB7XG5cdFx0XHRcdGRlYnVnLmxvZygnZ2V0QWdlbnRzU3RhdCBkYXRhOiAnLCBhc3RhdC5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdGFnZW50U3RhdCA9IGFzdGF0LmRhdGEucmVzdWx0XG5cdFx0XHRcdHJldHVybiBnZXRQZXJmU3RhdCh2bS5zZXR0aW5ncy50YWJsZXMsIHZtLmJlZ2luLnZhbHVlT2YoKSwgdm0uZW5kLnZhbHVlT2YoKSk7XG5cdFx0XHR9KVxuXHRcdFx0LnRoZW4oZnVuY3Rpb24ocHN0YXQpIHtcblx0XHRcdFx0ZGVidWcubG9nKCdnZXRQZXJmU3RhdCBkYXRhOiAnLCBwc3RhdC5kYXRhLnJlc3VsdCk7XG5cdFx0XHRcdHBlcmZTdGF0ID0gcHN0YXQuZGF0YS5yZXN1bHQ7XG5cdFx0XHRcdHZtLnN0YXQgPSBhbmd1bGFyLm1lcmdlKFtdLCBhZ2VudFN0YXQsIHBlcmZTdGF0KTtcblx0XHRcdFx0dm0uc3RhdC5tYXAoYWRkUGVyZlZhbHVlKTtcblx0XHRcdFx0XG5cdFx0XHRcdGRlYnVnLmxvZygndm0uc3RhdDogJywgdm0uc3RhdCk7XG5cdFx0XHRcdHNwaW5uZXJTZXJ2aWNlLmhpZGUoJ2Nyci1sb2FkZXInKTtcblx0XHRcdH0pXG5cdFx0XHQuY2F0Y2goZXJyb3JTZXJ2aWNlLnNob3cpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldEFnZW50c1N0YXQodGFibGVzLCBiZWdpbiwgZW5kKXtcblx0XHRcdHZhciBkYXRhLFxuXHRcdFx0bWV0cmljcyA9IFsnY291bnQoKiknLCdzdW0oY29ubmVjdFRpbWUpJywnYXZnKGNvbm5lY3RUaW1lKSddO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHR0YWJyZWw6ICd0YXNraWQgaW4gKFxcJycrdm0udGFza3Muam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQnLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLFxuXHRcdFx0XHRiZWdpbjogYmVnaW4sXG5cdFx0XHRcdGVuZDogZW5kLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBnZXRQZXJmU3RhdCh0YWJsZXMsIGJlZ2luLCBlbmQpe1xuXHRcdFx0dmFyIGRhdGEsXG5cdFx0XHRtZXRyaWNzID0gWydjb3VudChjYWxscmVzdWx0KSddO1xuXG5cdFx0XHRyZXR1cm4gYXBpLmdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHtcblx0XHRcdFx0dGFibGVzOiBbdGFibGVzLmNhbGxzLm5hbWVdLFxuXHRcdFx0XHR0YWJyZWw6ICd0YXNraWQgaW4gKFxcJycrdm0udGFza3Muam9pbignXFwnLFxcJycpKydcXCcpJytcblx0XHRcdFx0XHRcdCcgYW5kICcrW3RhYmxlcy5jYWxscy5uYW1lLCB0YWJsZXMuY2FsbHMuY29sdW1ucy5vcGVyYXRvcl0uam9pbignLicpKyc9cHJvY2Vzc2VkLmFnZW50aWQnK1xuXHRcdFx0XHRcdFx0JyBhbmQgJytbdGFibGVzLmNhbGxzLm5hbWUsIHRhYmxlcy5jYWxscy5jb2x1bW5zLmNhbGxyZXN1bHRdLmpvaW4oJy4nKSsnPTEnLFxuXHRcdFx0XHRwcm9jaWQ6IFt0YWJsZXMuY2FsbHMubmFtZSwgdGFibGVzLmNhbGxzLmNvbHVtbnMucHJvY2Vzc19pZF0uam9pbignLicpLFxuXHRcdFx0XHRjb2x1bW5zOiBbdGFibGVzLmNhbGxzLmNvbHVtbnMuY2FsbHJlc3VsdCwgdGFibGVzLmNhbGxzLmNvbHVtbnMub3BlcmF0b3JdLFxuXHRcdFx0XHRiZWdpbjogYmVnaW4sXG5cdFx0XHRcdGVuZDogZW5kLFxuXHRcdFx0XHRtZXRyaWNzOiBtZXRyaWNzXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhZGRQZXJmVmFsdWUoaXRlbSkge1xuXHRcdFx0aXRlbS5wZXJmID0gaXRlbVsnY291bnQoY2FsbHJlc3VsdCknXSAvIGl0ZW1bJ2NvdW50KCopJ10gKiAxMDA7XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsImFuZ3VsYXIubW9kdWxlKCdhcHAuY3JyJylcbi5jb25maWcoWyckcm91dGVQcm92aWRlcicsIGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKXtcblxuXHQkcm91dGVQcm92aWRlci5cblx0XHR3aGVuKCcvY3JyJywge1xuXHRcdFx0dGVtcGxhdGVVcmw6ICdjcnIvY3JyLmh0bWwnLFxuXHRcdFx0Y29udHJvbGxlcjogJ0NyckNvbnRyb2xsZXInLFxuXHRcdFx0Y29udHJvbGxlckFzOiAnY3JyVm0nXG5cdFx0fSk7XG59XSk7IiwiYW5ndWxhci5tb2R1bGUoJ2FwcCcpXG4uZmlsdGVyKCdjb252ZXJ0Qnl0ZXMnLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGludGVnZXIsIGZyb21Vbml0cywgdG9Vbml0cykge1xuICAgIHZhciBjb2VmZmljaWVudHMgPSB7XG4gICAgICAgICdCeXRlJzogMSxcbiAgICAgICAgJ0tCJzogMTAwMCxcbiAgICAgICAgJ01CJzogMTAwMDAwMCxcbiAgICAgICAgJ0dCJzogMTAwMDAwMDAwMFxuICAgIH07XG4gICAgcmV0dXJuIGludGVnZXIgKiBjb2VmZmljaWVudHNbZnJvbVVuaXRzXSAvIGNvZWZmaWNpZW50c1t0b1VuaXRzXTtcbiAgfTtcbn0pXG4uZmlsdGVyKCdhdmVyYWdlJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgbnVtYmVyKSB7XG5cdFx0aWYodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXHRcdFxuXHRcdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKSAvIChudW1iZXIgfHwgMSk7XG5cdH07XG59KVxuLmZpbHRlcigndGltZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBmcmFjdGlvbikge1xuXHRcdGlmKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblx0XHRcblx0XHR2YXIgZmlsdGVyZWQgPSBwYXJzZUZsb2F0KHZhbHVlKSxcblx0XHRcdGhoID0gMCwgbW0gPSAwLCBzcyA9IDA7XG5cblx0XHRmdW5jdGlvbiBwcmVwYXJlKG51bWJlcil7XG5cdFx0XHRyZXR1cm4gTWF0aC5mbG9vcihudW1iZXIpID4gOSA/IE1hdGguZmxvb3IobnVtYmVyKSA6ICcwJytNYXRoLmZsb29yKG51bWJlcik7XG5cdFx0fVxuXG5cdFx0aGggPSBmaWx0ZXJlZCAvIDM2MDA7XG5cdFx0bW0gPSAoZmlsdGVyZWQgJSAzNjAwKSAvIDYwO1xuXHRcdHNzID0gKG1tICUgMSkvMTAwKjYwKjEwMDtcblxuXHRcdHJldHVybiBwcmVwYXJlKGhoKSsnOicrcHJlcGFyZShtbSkrJzonK3ByZXBhcmUoc3MpO1xuXHR9O1xufSlcbi5maWx0ZXIoJ2R1cmF0aW9uJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbih2YWx1ZSwgZnJhY3Rpb24pIHtcblx0XHRpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cdFx0XG5cdFx0dmFyIGZpbHRlcmVkID0gcGFyc2VGbG9hdCh2YWx1ZSksXG5cdFx0XHRwcmVmaXggPSAncyc7XG5cblx0XHRpZihmaWx0ZXJlZCA+IDM2MDApIHtcblx0XHRcdGZpbHRlcmVkID0gZmlsdGVyZWQgLyAzNjAwO1xuXHRcdFx0cHJlZml4ID0gJ2gnO1xuXHRcdH0gZWxzZSBpZihmaWx0ZXJlZCA+IDYwKSB7XG5cdFx0XHRmaWx0ZXJlZCA9IGZpbHRlcmVkIC8gNjA7XG5cdFx0XHRwcmVmaXggPSAnbSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZpbHRlcmVkID0gZmlsdGVyZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXJlZC50b0ZpeGVkKGZyYWN0aW9uIHx8IDIpICsgJyAnICsgcHJlZml4O1xuXHR9O1xufSlcbi5maWx0ZXIoJ2RpZmYnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHByZXZ2YWx1ZSwgbmV4dHZhbHVlLCB1bml0KSB7XG5cdFx0aWYocHJldnZhbHVlID09PSB1bmRlZmluZWQgJiYgbmV4dHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuXHRcdHZhciBpbnRQcmV2VmFsdWUgPSBwcmV2dmFsdWUgPyBwYXJzZUZsb2F0KHByZXZ2YWx1ZSkgOiAwLFxuXHRcdFx0aW50TmV4dFZhbHVlID0gbmV4dHZhbHVlID8gcGFyc2VGbG9hdChuZXh0dmFsdWUpIDogMCxcblx0XHRcdGZpbHRlcmVkLCBkaWZmLCBwcmVmaXggPSAnKycsIGR5bmFtaWNzID0gdHJ1ZTtcblxuXHRcdGlmKGludFByZXZWYWx1ZSA+IGludE5leHRWYWx1ZSkge1xuXHRcdFx0ZGlmZiA9IGludFByZXZWYWx1ZSAtIGludE5leHRWYWx1ZTtcblx0XHRcdGZpbHRlcmVkID0gZGlmZiAqIDEwMCAvIGludFByZXZWYWx1ZTtcblx0XHRcdHByZWZpeCA9ICctJztcblx0XHRcdGR5bmFtaWNzID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpZmYgPSBpbnROZXh0VmFsdWUgLSBpbnRQcmV2VmFsdWU7XG5cdFx0XHRmaWx0ZXJlZCA9IGRpZmYgKiAxMDAgLyBpbnROZXh0VmFsdWU7XG5cdFx0fVxuXG5cdFx0aWYodW5pdCA9PT0gJ3ZhbHVlJykge1xuXHRcdFx0cmV0dXJuIHByZWZpeCtkaWZmO1xuXHRcdH0gZWxzZSBpZih1bml0ID09PSAnZHluYW1pY3MnKSB7XG5cdFx0XHRyZXR1cm4gZHluYW1pY3M7XG5cdFx0fSBlbHNlIGlmKHVuaXQgPT09ICdkeW5hbWljcy1yZXZlcnNlJykge1xuXHRcdFx0cmV0dXJuICFkeW5hbWljcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByZWZpeCtmaWx0ZXJlZC50b0ZpeGVkKDEpKyclJztcblx0XHR9XG5cdH07XG59KVxuLmZpbHRlcignZHluYW1pY3MnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKHZhbHVlMSwgdmFsdWUyKSB7XG5cdFx0aWYodmFsdWUxID09PSB1bmRlZmluZWQgJiYgdmFsdWUyID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuXHRcdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlMSkgPiBwYXJzZUZsb2F0KHZhbHVlMikgPyAncG9zaXRpdmUnIDogJ25lZ2F0aXZlJztcblx0fTtcbn0pOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnYXBpU2VydmljZScsIGFwaVNlcnZpY2UpO1xuXG4gICAgYXBpU2VydmljZS4kaW5qZWN0ID0gWyckaHR0cCcsICdhcHBDb25maWcnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBhcGlTZXJ2aWNlKCRodHRwLCBhcHBDb25maWcsIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgdmFyIGJhc2VVcmwgPSBhcHBDb25maWcuc2VydmVyO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBnZXREYlNldHRpbmdzOiBnZXREYlNldHRpbmdzLFxuICAgICAgICAgICAgZ2V0VGFza3M6IGdldFRhc2tzLFxuICAgICAgICAgICAgZ2V0VGFza0dyb3VwU3RhdGlzdGljczogZ2V0VGFza0dyb3VwU3RhdGlzdGljcyxcbiAgICAgICAgICAgIGdldEN1c3RvbUxpc3RTdGF0aXN0aWNzOiBnZXRDdXN0b21MaXN0U3RhdGlzdGljcyxcbiAgICAgICAgICAgIGdldFF1ZXJ5UmVzdWx0U2V0OiBnZXRRdWVyeVJlc3VsdFNldFxuXG4gICAgICAgIH07XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0RGJTZXR0aW5ncygpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zdGF0L2RiLmpzb24nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRhc2tzKHBhcmFtcywgY2IpIHtcbiAgICAgICAgICAgIHZhciByZXFQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0VGFza3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFRhc2tHcm91cFN0YXRpc3RpY3MocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFRhc2tHcm91cFN0YXRpc3RpY3MnLFxuICAgICAgICAgICAgICAgIHBhcmFtczogcGFyYW1zXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldEN1c3RvbUxpc3RTdGF0aXN0aWNzKHBhcmFtcykge1xuICAgICAgICAgICAgdmFyIHJlcVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXRDdXN0b21MaXN0U3RhdGlzdGljcycsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXNcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdChiYXNlVXJsLCByZXFQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0UXVlcnlSZXN1bHRTZXQocGFyYW1zKSB7XG4gICAgICAgICAgICB2YXIgcmVxUGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldFF1ZXJ5UmVzdWx0U2V0JyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgcXVlcnk6IFsnU0VMRUNUJywgcGFyYW1zLmNvbHVtbnMsICdGUk9NJywgcGFyYW1zLnRhYmxlcywgJ1dIRVJFJywgJ3Byb2Nlc3NlZC5wcm9jaWQ9JytwYXJhbXMucHJvY2lkLCAnYW5kJywgcGFyYW1zLnRhYnJlbCwgJ2FuZCB0aW1lc3RhcnQgYmV0d2VlbicsIG1vbWVudChwYXJhbXMuYmVnaW4pLnVuaXgoKSwgJ2FuZCcsIG1vbWVudChwYXJhbXMuZW5kKS51bml4KCksIChwYXJhbXMuZ3JvdXBCeSA/ICdncm91cCBieSAnK3BhcmFtcy5ncm91cEJ5IDogJycpXS5qb2luKCcgJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoYmFzZVVybCwgcmVxUGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnY29sb3VyR2VuZXJhdG9yJywgY29sb3VyR2VuZXJhdG9yKTtcblxuICAgIGZ1bmN0aW9uIGNvbG91ckdlbmVyYXRvcigpe1xuXG4gICAgICAgIC8vIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL3JhbmRvbS1tYXRlcmlhbC1jb2xvclxuXG4gICAgICAgIHZhciBkZWZhdWx0UGFsZXR0ZSA9IHtcbiAgICAgICAgICAgIC8vIFJlZCwgUGluaywgUHVycGxlLCBEZWVwIFB1cnBsZSwgSW5kaWdvLCBCbHVlLCBMaWdodCBCbHVlLCBDeWFuLCBUZWFsLCBHcmVlbiwgTGlnaHQgR3JlZW4sIExpbWUsIFllbGxvdywgQW1iZXIsIE9yYW5nZSwgRGVlcCBPcmFuZ2UsIEJyb3duLCBHcmV5LCBCbHVlIEdyZXlcbiAgICAgICAgICAgICc1MCc6IFsnI0ZGRUJFRScsICcjRkNFNEVDJywgJyNGM0U1RjUnLCAnI0VERTdGNicsICcjRThFQUY2JywgJyNFM0YyRkQnLCAnI0UxRjVGRScsICcjRTBGN0ZBJywgJyNFMEYyRjEnLCAnI0U4RjVFOScsICcjRjFGOEU5JywgJyNGOUZCRTcnLCAnI0ZGRkRFNycsICcjRkZGOEUxJywgJyNGRkYzRTAnLCAnI0ZCRTlFNycsICcjRUZFQkU5JywgJyNGQUZBRkEnLCAnI0VDRUZGMSddLFxuICAgICAgICAgICAgJzEwMCc6IFsnI0ZGQ0REMicsICcjRjhCQkQwJywgJyNFMUJFRTcnLCAnI0QxQzRFOScsICcjQzVDQUU5JywgJyNCQkRFRkInLCAnI0IzRTVGQycsICcjQjJFQkYyJywgJyNCMkRGREInLCAnI0M4RTZDOScsICcjRENFREM4JywgJyNGMEY0QzMnLCAnI0ZGRjlDNCcsICcjRkZFQ0IzJywgJyNGRkUwQjInLCAnI0ZGQ0NCQycsICcjRDdDQ0M4JywgJyNGNUY1RjUnLCAnI0NGRDhEQyddLFxuICAgICAgICAgICAgJzIwMCc6IFsnI0VGOUE5QScsICcjRjQ4RkIxJywgJyNDRTkzRDgnLCAnI0IzOUREQicsICcjOUZBOERBJywgJyM5MENBRjknLCAnIzgxRDRGQScsICcjODBERUVBJywgJyM4MENCQzQnLCAnI0E1RDZBNycsICcjQzVFMUE1JywgJyNFNkVFOUMnLCAnI0ZGRjU5RCcsICcjRkZFMDgyJywgJyNGRkNDODAnLCAnI0ZGQUI5MScsICcjQkNBQUE0JywgJyNFRUVFRUUnLCAnI0IwQkVDNSddLFxuICAgICAgICAgICAgJzMwMCc6IFsnI0U1NzM3MycsICcjRjA2MjkyJywgJyNCQTY4QzgnLCAnIzk1NzVDRCcsICcjNzk4NkNCJywgJyM2NEI1RjYnLCAnIzRGQzNGNycsICcjNEREMEUxJywgJyM0REI2QUMnLCAnIzgxQzc4NCcsICcjQUVENTgxJywgJyNEQ0U3NzUnLCAnI0ZGRjE3NicsICcjRkZENTRGJywgJyNGRkI3NEQnLCAnI0ZGOEE2NScsICcjQTE4ODdGJywgJyNFMEUwRTAnLCAnIzkwQTRBRSddLFxuICAgICAgICAgICAgJzQwMCc6IFsnI0VGNTM1MCcsICcjRUM0MDdBJywgJyNBQjQ3QkMnLCAnIzdFNTdDMicsICcjNUM2QkMwJywgJyM0MkE1RjUnLCAnIzI5QjZGNicsICcjMjZDNkRBJywgJyMyNkE2OUEnLCAnIzY2QkI2QScsICcjOUNDQzY1JywgJyNENEUxNTcnLCAnI0ZGRUU1OCcsICcjRkZDQTI4JywgJyNGRkE3MjYnLCAnI0ZGNzA0MycsICcjOEQ2RTYzJywgJyNCREJEQkQnLCAnIzc4OTA5QyddLFxuICAgICAgICAgICAgJzUwMCc6IFsnI0Y0NDMzNicsICcjRTkxRTYzJywgJyM5QzI3QjAnLCAnIzY3M0FCNycsICcjM0Y1MUI1JywgJyMyMTk2RjMnLCAnIzAzQTlGNCcsICcjMDBCQ0Q0JywgJyMwMDk2ODgnLCAnIzRDQUY1MCcsICcjOEJDMzRBJywgJyNDRERDMzknLCAnI0ZGRUIzQicsICcjRkZDMTA3JywgJyNGRjk4MDAnLCAnI0ZGNTcyMicsICcjNzk1NTQ4JywgJyM5RTlFOUUnLCAnIzYwN0Q4QiddLFxuICAgICAgICAgICAgJzYwMCc6IFsnI0U1MzkzNScsICcjRDgxQjYwJywgJyM4RTI0QUEnLCAnIzVFMzVCMScsICcjMzk0OUFCJywgJyMxRTg4RTUnLCAnIzAzOUJFNScsICcjMDBBQ0MxJywgJyMwMDg5N0InLCAnIzQzQTA0NycsICcjN0NCMzQyJywgJyNDMENBMzMnLCAnI0ZERDgzNScsICcjRkZCMzAwJywgJyNGQjhDMDAnLCAnI0Y0NTExRScsICcjNkQ0QzQxJywgJyM3NTc1NzUnLCAnIzU0NkU3QSddLFxuICAgICAgICAgICAgJzcwMCc6IFsnI0QzMkYyRicsICcjQzIxODVCJywgJyM3QjFGQTInLCAnIzUxMkRBOCcsICcjMzAzRjlGJywgJyMxOTc2RDInLCAnIzAyODhEMScsICcjMDA5N0E3JywgJyMwMDc5NkInLCAnIzM4OEUzQycsICcjNjg5RjM4JywgJyNBRkI0MkInLCAnI0ZCQzAyRCcsICcjRkZBMDAwJywgJyNGNTdDMDAnLCAnI0U2NEExOScsICcjNUQ0MDM3JywgJyM2MTYxNjEnLCAnIzQ1NUE2NCddLFxuICAgICAgICAgICAgJzgwMCc6IFsnI0M2MjgyOCcsICcjQUQxNDU3JywgJyM2QTFCOUEnLCAnIzQ1MjdBMCcsICcjMjgzNTkzJywgJyMxNTY1QzAnLCAnIzAyNzdCRCcsICcjMDA4MzhGJywgJyMwMDY5NUMnLCAnIzJFN0QzMicsICcjNTU4QjJGJywgJyM5RTlEMjQnLCAnI0Y5QTgyNScsICcjRkY4RjAwJywgJyNFRjZDMDAnLCAnI0Q4NDMxNScsICcjNEUzNDJFJywgJyM0MjQyNDInLCAnIzM3NDc0RiddLFxuICAgICAgICAgICAgJzkwMCc6IFsnI0I3MUMxQycsICcjODgwRTRGJywgJyM0QTE0OEMnLCAnIzMxMUI5MicsICcjMUEyMzdFJywgJyMwRDQ3QTEnLCAnIzAxNTc5QicsICcjMDA2MDY0JywgJyMwMDRENDAnLCAnIzFCNUUyMCcsICcjMzM2OTFFJywgJyM4Mjc3MTcnLCAnI0Y1N0YxNycsICcjRkY2RjAwJywgJyNFNjUxMDAnLCAnI0JGMzYwQycsICcjM0UyNzIzJywgJyMyMTIxMjEnLCAnIzI2MzIzOCddLFxuICAgICAgICAgICAgJ0ExMDAnOiBbJyNGRjhBODAnLCAnI0ZGODBBQicsICcjRUE4MEZDJywgJyNCMzg4RkYnLCAnIzhDOUVGRicsICcjODJCMUZGJywgJyM4MEQ4RkYnLCAnIzg0RkZGRicsICcjQTdGRkVCJywgJyNCOUY2Q0EnLCAnI0NDRkY5MCcsICcjRjRGRjgxJywgJyNGRkZGOEQnLCAnI0ZGRTU3RicsICcjRkZEMTgwJywgJyNGRjlFODAnXSxcbiAgICAgICAgICAgICdBMjAwJzogWycjRkY1MjUyJywgJyNGRjQwODEnLCAnI0UwNDBGQicsICcjN0M0REZGJywgJyM1MzZERkUnLCAnIzQ0OEFGRicsICcjNDBDNEZGJywgJyMxOEZGRkYnLCAnIzY0RkZEQScsICcjNjlGMEFFJywgJyNCMkZGNTknLCAnI0VFRkY0MScsICcjRkZGRjAwJywgJyNGRkQ3NDAnLCAnI0ZGQUI0MCcsICcjRkY2RTQwJ10sXG4gICAgICAgICAgICAnQTQwMCc6IFsnI0ZGMTc0NCcsICcjRjUwMDU3JywgJyNENTAwRjknLCAnIzY1MUZGRicsICcjM0Q1QUZFJywgJyMyOTc5RkYnLCAnIzAwQjBGRicsICcjMDBFNUZGJywgJyMxREU5QjYnLCAnIzAwRTY3NicsICcjNzZGRjAzJywgJyNDNkZGMDAnLCAnI0ZGRUEwMCcsICcjRkZDNDAwJywgJyNGRjkxMDAnLCAnI0ZGM0QwMCddLFxuICAgICAgICAgICAgJ0E3MDAnOiBbJyNENTAwMDAnLCAnI0M1MTE2MicsICcjQUEwMEZGJywgJyM2MjAwRUEnLCAnIzMwNEZGRScsICcjMjk2MkZGJywgJyMwMDkxRUEnLCAnIzAwQjhENCcsICcjMDBCRkE1JywgJyMwMEM4NTMnLCAnIzY0REQxNycsICcjQUVFQTAwJywgJyNGRkQ2MDAnLCAnI0ZGQUIwMCcsICcjRkY2RDAwJywgJyNERDJDMDAnXVxuICAgICAgICB9O1xuXG4gICAgICAgIC8qIHVzZWRDb2xvcnMgPSBbeyB0ZXh0OlNvbWVUZXh0LCBjb2xvcjogU29tZUNvbG9yIH1dICovXG4gICAgICAgIHZhciB1c2VkQ29sb3JzID0gW107XG4gICAgICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHNoYWRlczogWyc1MCcsICcxMDAnLCAnMjAwJywgJzMwMCcsICc0MDAnLCAnNTAwJywgJzYwMCcsICc3MDAnLCAnODAwJywgJzkwMCcsICdBMTAwJywgJ0EyMDAnLCAnQTQwMCcsICdBNzAwJ10sXG4gICAgICAgICAgICBwYWxldHRlOiBkZWZhdWx0UGFsZXR0ZSxcbiAgICAgICAgICAgIHRleHQ6IG51bGwsXG4gICAgICAgICAgICBpZ25vcmVDb2xvcnM6IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldENvbG9yOiBnZXRDb2xvclxuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldENvbG9yKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSBkZWZhdWx0T3B0aW9ucyk7XG4gICAgICAgICAgICBvcHRpb25zLnBhbGV0dGUgfHwgKG9wdGlvbnMucGFsZXR0ZSA9IGRlZmF1bHRQYWxldHRlKTtcbiAgICAgICAgICAgIG9wdGlvbnMuc2hhZGVzIHx8IChvcHRpb25zLnNoYWRlcyA9IFsnNTAwJ10pO1xuXG4gICAgICAgICAgICB2YXIgbCA9IHVzZWRDb2xvcnMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGNvbG9yO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLnRleHQgJiYgdXNlZENvbG9yc1tpXS50ZXh0ID09PSBvcHRpb25zLnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVzZWRDb2xvcnNbaV0uY29sb3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb2xvciA9IHBpY2tDb2xvcihvcHRpb25zKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudGV4dCkge1xuICAgICAgICAgICAgICAgIHVzZWRDb2xvcnMucHVzaCh7dGV4dDogb3B0aW9ucy50ZXh0LCBjb2xvcjogY29sb3J9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNvbG9yO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcGlja0NvbG9yKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBzaGFkZSA9IG9wdGlvbnMuc2hhZGVzW2dldFJhbmRvbUludChvcHRpb25zLnNoYWRlcy5sZW5ndGgpXTtcbiAgICAgICAgICAgIHZhciBjb2xvciA9ICcnO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gb3B0aW9ucy5wYWxldHRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucGFsZXR0ZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGtleSA9PT0gc2hhZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29sb3IgPSBvcHRpb25zLnBhbGV0dGVba2V5XVtnZXRSYW5kb21JbnQob3B0aW9ucy5wYWxldHRlW2tleV0ubGVuZ3RoKV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY29sb3I7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRSYW5kb21JbnQobWF4KSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCkpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdkZWJ1Z1NlcnZpY2UnLCBkZWJ1Z1NlcnZpY2UpO1xuXG4gICAgZGVidWdTZXJ2aWNlLiRpbmplY3QgPSBbJyRsb2cnLCAnc3RvcmUnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBkZWJ1Z1NlcnZpY2UoJGxvZywgc3RvcmUsIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGxvZzogZnVuY3Rpb24obWVzc2FnZSl7IGxvZyhhcmd1bWVudHMsICdsb2cnKTsgfSxcbiAgICAgICAgICAgIGluZm86IGZ1bmN0aW9uKG1lc3NhZ2UpeyBsb2coYXJndW1lbnRzLCAnaW5mbycpOyB9LFxuICAgICAgICAgICAgd2FybjogZnVuY3Rpb24obWVzc2FnZSl7IGxvZyhhcmd1bWVudHMsICd3YXJuJyk7IH0sXG4gICAgICAgICAgICBlcnJvcjogZXJyb3JTZXJ2aWNlLnNob3dcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBsb2coYXJncywgbWV0aG9kKXtcbiAgICAgICAgICAgIGlmKHN0b3JlLmdldCgnZGVidWcnKSkge1xuICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChhcmdzLCBmdW5jdGlvbihhcmcpe1xuICAgICAgICAgICAgICAgICAgICAkbG9nW21ldGhvZF0oYXJnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ2Vycm9yU2VydmljZScsIGVycm9yU2VydmljZSk7XG5cbiAgICBlcnJvclNlcnZpY2UuJGluamVjdCA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZXJyb3JTZXJ2aWNlKCl7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNob3c6IHNob3dcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBzaG93KGVycm9yKXtcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIC8vICR0cmFuc2xhdGUoJ0VSUk9SUy4nK2Vycm9yKVxuICAgICAgICAgICAgLy8gLnRoZW4oZnVuY3Rpb24gKHRyYW5zbGF0aW9uKXtcbiAgICAgICAgICAgIC8vICAgICBpZignRVJST1JTLicrZXJyb3IgPT09IHRyYW5zbGF0aW9uKSB7XG4gICAgICAgICAgICAvLyAgICAgICAgIG5vdGlmaWNhdGlvbnMuc2hvd0Vycm9yKCdFUlJPUl9PQ0NVUlJFRCcpO1xuICAgICAgICAgICAgLy8gICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyAgICAgICAgIG5vdGlmaWNhdGlvbnMuc2hvd0Vycm9yKHRyYW5zbGF0aW9uKTtcbiAgICAgICAgICAgIC8vICAgICB9XG4gICAgICAgICAgICAvLyB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgnU2V0dGluZ3NTZXJ2aWNlJywgU2V0dGluZ3NTZXJ2aWNlKTtcblxuICAgIFNldHRpbmdzU2VydmljZS4kaW5qZWN0ID0gWyckcScsICdhcGlTZXJ2aWNlJywgJ2Vycm9yU2VydmljZSddO1xuXG4gICAgZnVuY3Rpb24gU2V0dGluZ3NTZXJ2aWNlKCRxLCBhcGksIGVycm9yU2VydmljZSl7XG5cbiAgICAgICAgdmFyIHNldHRpbmdzID0gbnVsbDtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0U2V0dGluZ3M6IGdldFNldHRpbmdzXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICAvLyBHZXQgREIgc2V0dGluZ3MgZnJvbSBjYWNoZSBvciBKU09OIGZpbGVcbiAgICAgICAgZnVuY3Rpb24gZ2V0U2V0dGluZ3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gJHEoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgaWYoc2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhcGkuZ2V0RGJTZXR0aW5ncygpXG4gICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oZGJTZXR0aW5ncyl7XG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdzID0gZGJTZXR0aW5ncy5kYXRhO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHNldHRpbmdzKTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbihlcnIpe1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICBhbmd1bGFyXG4gICAgICAgIC5tb2R1bGUoJ2FwcCcpXG4gICAgICAgIC5mYWN0b3J5KCdUYXNrc1NlcnZpY2UnLCBUYXNrc1NlcnZpY2UpO1xuXG4gICAgVGFza3NTZXJ2aWNlLiRpbmplY3QgPSBbJ2FwaVNlcnZpY2UnLCAnZXJyb3JTZXJ2aWNlJ107XG5cbiAgICBmdW5jdGlvbiBUYXNrc1NlcnZpY2UoYXBpLCBlcnJvclNlcnZpY2Upe1xuXG4gICAgICAgIHZhciB0YXNrcyA9IFtcbiAgICAgICAgICAgIHtuYW1lOiAnSW5jb21pbmdfQWdlbnQnLCBraW5kOiAxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWVzc2FnaW5nX0NoYXQnLCBraW5kOiA3fSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXV0b2RpYWxfQWdlbnQnLCBraW5kOiAxMjl9XG4gICAgICAgIF07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGdldFRhc2tzOiBnZXRUYXNrcyxcbiAgICAgICAgICAgIGdldFRhc2tMaXN0OiBnZXRUYXNrTGlzdFxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgZnVuY3Rpb24gZ2V0VGFza3MoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFza3M7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRUYXNrTGlzdChpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGFwaS5nZXRUYXNrcyh7IGtpbmQ6IGlkIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgYW5ndWxhclxuICAgICAgICAubW9kdWxlKCdhcHAnKVxuICAgICAgICAuZmFjdG9yeSgndXRpbHNTZXJ2aWNlJywgdXRpbHNTZXJ2aWNlKTtcblxuICAgIC8vIHV0aWxzU2VydmljZS4kaW5qZWN0ID0gW107XG5cbiAgICBmdW5jdGlvbiB1dGlsc1NlcnZpY2UoKXtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZ2V0VG90YWxzOiBnZXRUb3RhbHMsXG4gICAgICAgICAgICBzZXRQZXJjZW50YWdlVmFsdWVzOiBzZXRQZXJjZW50YWdlVmFsdWVzLFxuICAgICAgICAgICAgZ2V0QWJhbmRvbm1lbnRSYXRlOiBnZXRBYmFuZG9ubWVudFJhdGUsXG4gICAgICAgICAgICBnZXRTbEluZGV4OiBnZXRTbEluZGV4LFxuICAgICAgICAgICAgZ2V0RnJpZW5kbHlLaW5kOiBnZXRGcmllbmRseUtpbmQsXG4gICAgICAgICAgICBleHRlbmRBbmRTdW06IGV4dGVuZEFuZFN1bSxcbiAgICAgICAgICAgIHF1ZXJ5VG9PYmplY3Q6IHF1ZXJ5VG9PYmplY3QsXG4gICAgICAgICAgICBwZXJpb2RUb1JhbmdlOiBwZXJpb2RUb1JhbmdlLFxuICAgICAgICAgICAgZmlsdGVyQnlLZXk6IGZpbHRlckJ5S2V5LFxuICAgICAgICAgICAgZmlsdGVyVW5pcXVlOiBmaWx0ZXJVbmlxdWVcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBnZXRUb3RhbHMocHJldiwgbmV4dCl7XG4gICAgICAgICAgICB2YXIgdG90YWxzID0ge307XG4gICAgICAgICAgICBmb3IodmFyIGtleSBpbiBwcmV2KXtcbiAgICAgICAgICAgICAgICBpZighaXNOYU4ocGFyc2VGbG9hdChwcmV2W2tleV0pKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChuZXh0W2tleV0pKSkge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbHNba2V5XSA9IHBhcnNlRmxvYXQocHJldltrZXldKSArIHBhcnNlRmxvYXQobmV4dFtrZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG90YWxzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2V0UGVyY2VudGFnZVZhbHVlcyhkYXRhLCB0b3RhbHMpe1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBmb3IodmFyIGtleSBpbiBpdGVtKXtcbiAgICAgICAgICAgICAgICAgICAgaWYodG90YWxzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW1ba2V5KydfcCddID0gKGl0ZW1ba2V5XSAvIHRvdGFsc1trZXldICogMTAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0QWJhbmRvbm1lbnRSYXRlKG5jbywgbmNhKXtcbiAgICAgICAgICAgIHJldHVybiBuY2EgKiAxMDAgLyBuY287XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRTbEluZGV4KGFycmF5KXtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IC0xO1xuICAgICAgICAgICAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpKSB7XG4gICAgICAgICAgICAgICAgaWYoL15zbC8udGVzdChpdGVtKSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRGcmllbmRseUtpbmQoa2luZCl7XG4gICAgICAgICAgICB2YXIgZmtpbmQgPSAnJztcbiAgICAgICAgICAgIHN3aXRjaCAoa2luZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICAgICAgZmtpbmQgPSAnSW5jb21pbmdfQWdlbnQnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgICAgICAgICAgIGZraW5kID0gJ01lc3NhZ2luZ19DaGF0JztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAxMjk6XG4gICAgICAgICAgICAgICAgICAgIGZraW5kID0gJ0F1dG9kaWFsX0FnZW50JztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmtpbmQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmtpbmQ7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBleHRlbmRBbmRTdW0ob2JqMSwgb2JqMiwgaW5kZXgsIGFycmF5KXtcbiAgICAgICAgICAgIHZhciBrZXksIHZhbDEsIHZhbDI7XG4gICAgICAgICAgICBmb3IoIGtleSBpbiBvYmoyICkge1xuICAgICAgICAgICAgICAgIGlmKCBvYmoyLmhhc093blByb3BlcnR5KCBrZXkgKSApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsMSA9IGFuZ3VsYXIuaXNVbmRlZmluZWQob2JqMVtrZXldKSA/IDAgOiBvYmoxW2tleV07XG4gICAgICAgICAgICAgICAgICAgIHZhbDIgPSBhbmd1bGFyLmlzVW5kZWZpbmVkKG9iajJba2V5XSkgPyAwIDogcGFyc2VGbG9hdChvYmoyW2tleV0pO1xuICAgICAgICAgICAgICAgICAgICBpZighaXNOYU4odmFsMikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvdW50IHN1bSBhbmQgZmluZCBhdmVyYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICBvYmoxW2tleV0gPSBhbmd1bGFyLmlzTnVtYmVyKHZhbDEpID8gKHZhbDEgKyB2YWwyKSA6IChwYXJzZUZsb2F0KHZhbDEpICsgdmFsMikudG9GaXhlZCgyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmKGluZGV4ID09PSBhcnJheS5sZW5ndGgtMSkgb2JqMVtrZXldID0gb2JqMVtrZXldIC8gYXJyYXkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoYW5ndWxhci5pc0FycmF5KG9iajFba2V5XSkpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHB1c2ggdG8gdGhlIGFycmF5IG9mIHN0cmluZ3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmoxW2tleV0ucHVzaChvYmoyW2tleV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYSBuZXcgYXJyYXkgYW5kIGFkZCB2YWx1ZXMgdG8gaXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmoxW2tleV0gPSBbXS5jb25jYXQob2JqMVtrZXldLCBvYmoyW2tleV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajE7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBxdWVyeVRvT2JqZWN0KGRhdGEsIGtleXMpe1xuICAgICAgICAgICAgdmFyIG9iaiwga2V5O1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgICAgICAgICBvYmogPSB7fTtcbiAgICAgICAgICAgICAgICBpdGVtLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGtleSA9IGtleXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBvYmpba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHBlcmlvZFRvUmFuZ2UocGVyaW9kKXtcbiAgICAgICAgICAgIHZhciBhcnIgPSBwZXJpb2Quc3BsaXQoJyAnKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgYmVnaW46IG1vbWVudCgpLnN0YXJ0T2YoYXJyWzFdKS50b0RhdGUoKSxcbiAgICAgICAgICAgICAgICBlbmQ6IG1vbWVudCgpLmVuZE9mKGFyclsxXSkudG9EYXRlKClcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyByZXR1cm4gbW9tZW50KCkuc3VidHJhY3QoYXJyWzBdLCBhcnJbMV0pLnRvRGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZmlsdGVyQnlLZXkob2JqZWN0LCBrZXkpe1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdFtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZmlsdGVyVW5pcXVlKGl0ZW0sIGluZGV4LCBhcnJheSl7XG4gICAgICAgICAgICBpZihhcnJheS5pbmRleE9mKGl0ZW0pID09PSAtMSkgcmV0dXJuIGl0ZW07XG4gICAgICAgIH1cblxuICAgIH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdMYXlvdXRDb250cm9sbGVyJywgTGF5b3V0Q29udHJvbGxlcik7XG5cblx0TGF5b3V0Q29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJ107XG5cblx0ZnVuY3Rpb24gTGF5b3V0Q29udHJvbGxlcigkcm9vdFNjb3BlKSB7XG5cblx0XHR2YXIgdm0gPSB0aGlzO1xuXG5cdFx0XG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1NwaW5uZXJDb250cm9sbGVyJywgU3Bpbm5lckNvbnRyb2xsZXIpO1xuXG5cdFNwaW5uZXJDb250cm9sbGVyLiRpbmplY3QgPSBbJ3NwaW5uZXJTZXJ2aWNlJywgJyRzY29wZSddO1xuXG5cdGZ1bmN0aW9uIFNwaW5uZXJDb250cm9sbGVyKHNwaW5uZXJTZXJ2aWNlLCAkc2NvcGUpIHtcblxuXHRcdHZhciB2bSA9IHRoaXM7XG5cblx0XHQvLyByZWdpc3RlciBzaG91bGQgYmUgdHJ1ZSBieSBkZWZhdWx0IGlmIG5vdCBzcGVjaWZpZWQuXG5cdFx0aWYgKCF2bS5oYXNPd25Qcm9wZXJ0eSgncmVnaXN0ZXInKSkge1xuXHRcdFx0dm0ucmVnaXN0ZXIgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2bS5yZWdpc3RlciA9IHZtLnJlZ2lzdGVyLnRvTG93ZXJDYXNlKCkgPT09ICdmYWxzZScgPyBmYWxzZSA6IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gRGVjbGFyZSBhIG1pbmktQVBJIHRvIGhhbmQgb2ZmIHRvIG91ciBzZXJ2aWNlIHNvIHRoZSBzZXJ2aWNlXG5cdFx0Ly8gZG9lc24ndCBoYXZlIGEgZGlyZWN0IHJlZmVyZW5jZSB0byB0aGlzIGRpcmVjdGl2ZSdzIHNjb3BlLlxuXHRcdHZhciBhcGkgPSB7XG5cdFx0XHRuYW1lOiB2bS5uYW1lLFxuXHRcdFx0Z3JvdXA6IHZtLmdyb3VwLFxuXHRcdFx0c2hvdzogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2bS5zaG93ID0gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHRoaWRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZtLnNob3cgPSBmYWxzZTtcblx0XHRcdH0sXG5cdFx0XHR0b2dnbGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dm0uc2hvdyA9ICF2bS5zaG93O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBSZWdpc3RlciB0aGlzIHNwaW5uZXIgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlxuXHRcdGlmICh2bS5yZWdpc3RlciA9PT0gdHJ1ZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ3NwaW5uZXI6ICcsIGFwaSk7XG5cdFx0XHRzcGlubmVyU2VydmljZS5fcmVnaXN0ZXIoYXBpKTtcblx0XHR9XG5cblx0XHQvLyBJZiBhbiBvblNob3cgb3Igb25IaWRlIGV4cHJlc3Npb24gd2FzIHByb3ZpZGVkLCByZWdpc3RlciBhIHdhdGNoZXJcblx0XHQvLyB0aGF0IHdpbGwgZmlyZSB0aGUgcmVsZXZhbnQgZXhwcmVzc2lvbiB3aGVuIHNob3cncyB2YWx1ZSBjaGFuZ2VzLlxuXHRcdGlmICh2bS5vblNob3cgfHwgdm0ub25IaWRlKSB7XG5cdFx0XHQkc2NvcGUuJHdhdGNoKCdzaG93JywgZnVuY3Rpb24gKHNob3cpIHtcblx0XHRcdFx0aWYgKHNob3cgJiYgdm0ub25TaG93KSB7XG5cdFx0XHRcdFx0dm0ub25TaG93KHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIXNob3cgJiYgdm0ub25IaWRlKSB7XG5cdFx0XHRcdFx0dm0ub25IaWRlKHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgc3Bpbm5lciBpcyBnb29kIHRvIGdvLiBGaXJlIHRoZSBvbkxvYWRlZCBleHByZXNzaW9uLlxuXHRcdGlmICh2bS5vbkxvYWRlZCkge1xuXHRcdFx0dm0ub25Mb2FkZWQoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHR9XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwJylcblx0XHQuZGlyZWN0aXZlKCdzcGlubmVyJywgc3Bpbm5lcik7XG5cblx0ZnVuY3Rpb24gc3Bpbm5lcigpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0cmVwbGFjZTogdHJ1ZSxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRzY29wZToge1xuXHRcdFx0XHRuYW1lOiAnQD8nLFxuXHRcdFx0XHRncm91cDogJ0A/Jyxcblx0XHRcdFx0c2hvdzogJ0A/Jyxcblx0XHRcdFx0aW1nU3JjOiAnQD8nLFxuXHRcdFx0XHRyZWdpc3RlcjogJ0A/Jyxcblx0XHRcdFx0b25Mb2FkZWQ6ICcmPycsXG5cdFx0XHRcdG9uU2hvdzogJyY/Jyxcblx0XHRcdFx0b25IaWRlOiAnJj8nXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGU6IFtcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJzcGlubmVyLWxvYWRlciBhbmltYXRlLXNob3dcIiBuZy1zaG93PVwic2hvd1wiPicsXG5cdFx0XHRcdCcgIDxpbWcgbmctaWY9XCJpbWdTcmNcIiBuZy1zcmM9XCJ7e2ltZ1NyY319XCIgLz4nLFxuXHRcdFx0XHQnICA8bmctdHJhbnNjbHVkZT48L25nLXRyYW5zY2x1ZGU+Jyxcblx0XHRcdFx0JzwvZGl2Pidcblx0XHRcdF0uam9pbignJyksXG5cdFx0XHRjb250cm9sbGVyOiBbICckc2NvcGUnLCAnc3Bpbm5lclNlcnZpY2UnLCBmdW5jdGlvbigkc2NvcGUsIHNwaW5uZXJTZXJ2aWNlKSB7XG5cdFx0XHRcdC8vIHJlZ2lzdGVyIHNob3VsZCBiZSB0cnVlIGJ5IGRlZmF1bHQgaWYgbm90IHNwZWNpZmllZC5cblx0XHRcdFx0aWYgKCEkc2NvcGUuaGFzT3duUHJvcGVydHkoJ3JlZ2lzdGVyJykpIHtcblx0XHRcdFx0XHQkc2NvcGUucmVnaXN0ZXIgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdCRzY29wZS5yZWdpc3RlciA9ICRzY29wZS5yZWdpc3Rlci50b0xvd2VyQ2FzZSgpID09PSAnZmFsc2UnID8gZmFsc2UgOiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRGVjbGFyZSBhIG1pbmktQVBJIHRvIGhhbmQgb2ZmIHRvIG91ciBzZXJ2aWNlIHNvIHRoZSBzZXJ2aWNlXG5cdFx0XHRcdC8vIGRvZXNuJ3QgaGF2ZSBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhpcyBkaXJlY3RpdmUncyBzY29wZS5cblx0XHRcdFx0dmFyIGFwaSA9IHtcblx0XHRcdFx0XHRuYW1lOiAkc2NvcGUubmFtZSxcblx0XHRcdFx0XHRncm91cDogJHNjb3BlLmdyb3VwLFxuXHRcdFx0XHRcdHNob3c6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gdHJ1ZTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGhpZGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gZmFsc2U7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0b2dnbGU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdCRzY29wZS5zaG93ID0gISRzY29wZS5zaG93O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBSZWdpc3RlciB0aGlzIHNwaW5uZXIgd2l0aCB0aGUgc3Bpbm5lciBzZXJ2aWNlLlxuXHRcdFx0XHRpZiAoJHNjb3BlLnJlZ2lzdGVyID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ3NwaW5uZXI6ICcsIGFwaSk7XG5cdFx0XHRcdFx0c3Bpbm5lclNlcnZpY2UuX3JlZ2lzdGVyKGFwaSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiBhbiBvblNob3cgb3Igb25IaWRlIGV4cHJlc3Npb24gd2FzIHByb3ZpZGVkLCByZWdpc3RlciBhIHdhdGNoZXJcblx0XHRcdFx0Ly8gdGhhdCB3aWxsIGZpcmUgdGhlIHJlbGV2YW50IGV4cHJlc3Npb24gd2hlbiBzaG93J3MgdmFsdWUgY2hhbmdlcy5cblx0XHRcdFx0aWYgKCRzY29wZS5vblNob3cgfHwgJHNjb3BlLm9uSGlkZSkge1xuXHRcdFx0XHRcdCRzY29wZS4kd2F0Y2goJ3Nob3cnLCBmdW5jdGlvbiAoc2hvdykge1xuXHRcdFx0XHRcdFx0aWYgKHNob3cgJiYgJHNjb3BlLm9uU2hvdykge1xuXHRcdFx0XHRcdFx0XHQkc2NvcGUub25TaG93KHsgc3Bpbm5lclNlcnZpY2U6IHNwaW5uZXJTZXJ2aWNlLCBzcGlubmVyQXBpOiBhcGkgfSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFzaG93ICYmICRzY29wZS5vbkhpZGUpIHtcblx0XHRcdFx0XHRcdFx0JHNjb3BlLm9uSGlkZSh7IHNwaW5uZXJTZXJ2aWNlOiBzcGlubmVyU2VydmljZSwgc3Bpbm5lckFwaTogYXBpIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gVGhpcyBzcGlubmVyIGlzIGdvb2QgdG8gZ28uIEZpcmUgdGhlIG9uTG9hZGVkIGV4cHJlc3Npb24uXG5cdFx0XHRcdGlmICgkc2NvcGUub25Mb2FkZWQpIHtcblx0XHRcdFx0XHQkc2NvcGUub25Mb2FkZWQoeyBzcGlubmVyU2VydmljZTogc3Bpbm5lclNlcnZpY2UsIHNwaW5uZXJBcGk6IGFwaSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGFuZ3VsYXJcbiAgICAgICAgLm1vZHVsZSgnYXBwJylcbiAgICAgICAgLmZhY3RvcnkoJ3NwaW5uZXJTZXJ2aWNlJywgc3Bpbm5lclNlcnZpY2UpO1xuXG4gICAgZnVuY3Rpb24gc3Bpbm5lclNlcnZpY2UoKXtcblxuICAgICAgICB2YXIgc3Bpbm5lcnMgPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBfcmVnaXN0ZXI6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmhhc093blByb3BlcnR5KCduYW1lJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJTcGlubmVyIG11c3Qgc3BlY2lmeSBhIG5hbWUgd2hlbiByZWdpc3RlcmluZyB3aXRoIHRoZSBzcGlubmVyIHNlcnZpY2UuXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNwaW5uZXJzLmhhc093blByb3BlcnR5KGRhdGEubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJBIHNwaW5uZXIgd2l0aCB0aGUgbmFtZSAnXCIgKyBkYXRhLm5hbWUgKyBcIicgaGFzIGFscmVhZHkgYmVlbiByZWdpc3RlcmVkLlwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNwaW5uZXJzW2RhdGEubmFtZV0gPSBkYXRhO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNob3c6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNwaW5uZXIgPSBzcGlubmVyc1tuYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAoIXNwaW5uZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihuZXcgRXJyb3IoXCJObyBzcGlubmVyIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgcmVnaXN0ZXJlZC5cIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcGlubmVyLnNob3coKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoaWRlOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgICAgIHZhciBzcGlubmVyID0gc3Bpbm5lcnNbbmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFzcGlubmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHNwaW5uZXIgbmFtZWQgJ1wiICsgbmFtZSArIFwiJyBpcyByZWdpc3RlcmVkLlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3Bpbm5lci5oaWRlKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2hvd0FsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIG5hbWUgaW4gc3Bpbm5lcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgc3Bpbm5lcnNbbmFtZV0uc2hvdygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoaWRlQWxsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBzcGlubmVycykge1xuICAgICAgICAgICAgICAgICAgICBzcGlubmVyc1tuYW1lXS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgfVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmRpcmVjdGl2ZSgnc2lkZU1lbnUnLCBzaWRlTWVudSk7XG5cblx0ZnVuY3Rpb24gc2lkZU1lbnUoKXtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0FFJyxcblx0XHRcdHRyYW5zY2x1ZGU6IHRydWUsXG5cdFx0XHRjb250cm9sbGVyOiAnU2lkZW1lbnVDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ3NpZGVtZW51Vm0nLFxuXHRcdFx0dGVtcGxhdGVVcmw6ICdsYXlvdXQvc2lkZW1lbnUvc2lkZW1lbnUuaHRtbCdcblx0XHR9O1xuXG5cdH1cblxufSkoKTsiLCIoZnVuY3Rpb24oKXtcblxuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FwcC5sYXlvdXQnKVxuXHRcdC5jb250cm9sbGVyKCdTaWRlbWVudUNvbnRyb2xsZXInLCBTaWRlbWVudUNvbnRyb2xsZXIpO1xuXG5cdFNpZGVtZW51Q29udHJvbGxlci4kaW5qZWN0ID0gWyckcm9vdFNjb3BlJywgJyRtZFNpZGVuYXYnXTtcblxuXHRmdW5jdGlvbiBTaWRlbWVudUNvbnRyb2xsZXIoJHJvb3RTY29wZSwgJG1kU2lkZW5hdikge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblx0XHR2bS5pc09wZW4gPSBmYWxzZTtcblxuXHRcdCRyb290U2NvcGUuJG9uKCckcm91dGVDaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRpZih2bS5pc09wZW4pIFxuXHRcdFx0XHQkbWRTaWRlbmF2KCdzaWRlbmF2JykudG9nZ2xlKCk7XG5cdFx0fSk7XG5cblx0fVxuXG59KSgpOyIsIihmdW5jdGlvbigpe1xuXG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYXBwLmxheW91dCcpXG5cdFx0LmNvbnRyb2xsZXIoJ1RvcGJhckNvbnRyb2xsZXInLCBUb3BiYXJDb250cm9sbGVyKTtcblxuXHRUb3BiYXJDb250cm9sbGVyLiRpbmplY3QgPSBbJyRyb290U2NvcGUnLCAnJHNjb3BlJywgJyRtZFNpZGVuYXYnXTtcblxuXHRmdW5jdGlvbiBUb3BiYXJDb250cm9sbGVyKCRyb290U2NvcGUsICRzY29wZSwgJG1kU2lkZW5hdikge1xuXG5cdFx0dmFyIHZtID0gdGhpcztcblxuXHRcdHZtLnRvZ2dsZVNpZGVtZW51ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHQkbWRTaWRlbmF2KCdzaWRlbmF2JykudG9nZ2xlKCk7XG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7IiwiKGZ1bmN0aW9uKCl7XG5cblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhcHAubGF5b3V0Jylcblx0XHQuZGlyZWN0aXZlKCd0b3BCYXInLCB0b3BCYXIpO1xuXG5cdGZ1bmN0aW9uIHRvcEJhcigpe1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQUUnLFxuXHRcdFx0dHJhbnNjbHVkZTogdHJ1ZSxcblx0XHRcdGNvbnRyb2xsZXI6ICdUb3BiYXJDb250cm9sbGVyJyxcblx0XHRcdGNvbnRyb2xsZXJBczogJ3RvcGJhclZtJyxcblx0XHRcdHRlbXBsYXRlVXJsOiAnbGF5b3V0L3RvcGJhci90b3BiYXIuaHRtbCcsXG5cdFx0fTtcblxuXHR9XG5cbn0pKCk7Il0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
