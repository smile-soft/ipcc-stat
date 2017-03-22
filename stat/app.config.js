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