'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth) {
    $scope.menu = [
    {
      'title': 'Team',
      'link': '/'
    },
    {
      'title': 'Billing',
      'link': '/billing'
    },
    {
      'title': 'Get App',
      'link': 'https://chrome.google.com/webstore/detail/phasedio/pjjndifgelimoaljdogpjjdjhklajgfj?authuser=0'
    },
    {
      'title': 'Change Team',
      'link': '/switchteam'
    },
    {
      'title': 'Logout',
      'link': '',
      'click': function(){
        logout();
      }
    }
    
    ];

    $scope.isCollapsed = true;

    $scope.isActive = function(route) {
      return route === $location.path();
    };
    function logout(){
      console.log('logging you out');
      Auth.logout();
    }
  });