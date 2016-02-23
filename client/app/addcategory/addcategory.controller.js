'use strict';

angular.module('webappApp')
  .controller('AddcategoryCtrl', function ($scope, $http, stripe, Auth, FURL, Phased, amMoment, $location) {
    ga('send', 'pageview', '/addcategory');

    $scope.team = Phased.team;

    $scope.addCat = function(cat){
      mixpanel.track("Created category");
      ga('send', 'event', 'Category', 'Added new');
    	Phased.addCategory(cat);
    	$location.path('/feed');
    };

    $scope.deleteCat = function(key, event) {
      mixpanel.track("Deleted Category");
    	ga('send', 'event', 'Category', 'Deleted');
    	Phased.deleteCategory(key);
      $location.path("/");
    }

    // check if category exists
    $scope.categoryExists = function(newKey) {
    	var exists = false;
			for (var existingKey in Phased.team.categoryObj) {
				if (newKey == existingKey) {
					exists = true;
					break;
				}
			}
    	return exists;
    }

  });
