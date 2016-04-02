angular.module('webappApp')
	.directive('statusLazyLoader', ['Phased', function(Phased) {
		return {
			restrict: 'A',
			replace: true,
			templateUrl: 'components/status-lazy-loader/status-lazy-loader.template.html',
			link: function($scope, $el, $attrs) {
				$scope.testSth = Phased.getStatusesPage;
			}
		}
	}])