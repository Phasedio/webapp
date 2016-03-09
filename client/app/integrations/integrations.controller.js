'use strict';

angular.module('webappApp')
.controller('IntegrationsCtrl', function ($scope, $http, Auth, FURL, Phased, $location, $window) {
	ga('send', 'pageview', '/integrations');
	var ref = new Firebase(FURL);
	$scope.Phased = Phased;
	// console.log('integrations', Phased);

	// bounce users without Admin or Owner permissions
	var checkRole = function(){
		// do only after Phased is set up
		if (!Phased.SET_UP) {
			$scope.$on('Phased:setup', checkRole);
			return;
		}

		var myRole = Phased.team.members[Auth.user.uid].role;
		if (myRole != Phased.ROLE_ID.ADMIN && myRole != Phased.ROLE_ID.OWNER)
			$location.path('/');
	}
	checkRole();
	$scope.$on('Phased:memberChanged', checkRole);

	// bounce users if team has problems
	var checkTeam = function(){
		// do only after Phased is set up
		if (!Phased.SET_UP) {
			$scope.$on('Phased:setup', checkTeam);
			return;
		}
		var teamCheck = Phased.viewType;
		if (teamCheck == 'problem'){
			$location.path('/team-expired');
		}else if (teamCheck == 'canceled') {
			$location.path('/switchteam');
		}
	}
	checkTeam();
	$scope.$on('Phased:PaymentInfo', checkTeam);


	// 1. auth user to get token
	$scope.startGHAuth = function(e) {
		e.preventDefault();
		// $window.location.href = '/api/gh/auth';
		Auth.githubLogin(function(gh) {
			console.log('Phased', Phased);
		});
	}

	// 2. save token to member profile

	// 3. use token to register/deregister webhooks on behalf of team
});
