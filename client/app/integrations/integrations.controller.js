'use strict';

angular.module('webappApp')
.filter('hostname', function ($document) {
	return function (input) {
		var parser = document.createElement('a');
		parser.href = input;
		return parser.hostname;
	};
})
.controller('IntegrationsCtrl', function ($scope, $http, Auth, FURL, Phased, $location, $window) {
	ga('send', 'pageview', '/integrations');
	var ref = new Firebase(FURL);
	$scope.Phased = Phased;
	$scope.github = Auth.user.github;

	/**
	*	INIT
	*/

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

	// get repo hooks from github on load if user is authenticated
	Phased.getAllGHRepoHooks();


	/**
	*	FUNCTIONS
	*/

	// auth user to get token
	$scope.startGHAuth = function(e) {
		e.preventDefault();
		Auth.githubLogin(function(gh) {
			$scope.github = Auth.user.github;
		});
	}

	// list repos user owns
	$scope.showGHRepos = function(e) {
		e.preventDefault();
		Phased.getGHRepos(function(repos) {
			$scope.github.repos = repos; // GitHub repo data, not FB repo data
		});
	}
	
	// stages a repo if it's not already registered
	$scope.stageGHRepo = function(repo) {
		if (!Phased.team.repos || !(repo.id in Phased.team.repos)) 
			$scope.selectedRepo = repo;
	}

	$scope.registerSelectedGHRepo = function(){
		Phased.registerGHWebhookForRepo($scope.selectedRepo, function(result) {
			if (result)
				$('#choose-repo').modal('hide');
			$scope.selectedRepo = "";
		});
	}

	$scope.toggleGHHookActive = function(hook, repoID) {
		Phased.toggleGHWebhookActive(hook, repoID);
	}

	$scope.deleteGHHook = function(hook, repoID) {
		Phased.deleteGHWebhook(hook, repoID);
	}
});
