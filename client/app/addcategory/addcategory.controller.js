'use strict';

angular.module('webappApp')
  .controller('AddcategoryCtrl', function ($scope, $http, stripe, Auth, FURL, Phased, amMoment, $location) {
    ga('send', 'pageview', '/addcategory');

    $scope.team = Phased.team;

    $scope.addCat = function(cat){
      ga('send', 'event', 'Category', 'Added new');
    	Phased.addCategory(cat);
    	$location.path('/feed');
    };

  });
