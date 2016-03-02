'use strict';

angular.module('webappApp')
  .controller('AdminCsvDwlCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    var FBRef = new Firebase(FURL);
    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.Phased = Phased;

    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      var teamCheck = Phased.viewType;
      console.log(teamCheck);
      if (teamCheck == 'problem'){
        $location.path('/team-expired');
      }else if (teamCheck == 'canceled') {
        $location.path('/switchteam');
      }

    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

    //form vars

    var users = [],category = [],time = [];
    $scope.returnValues = false;
    $scope.catSelect = "";
    $scope.time = {
      start : '',
      end :''
    };
    var now = new Date().getTime();
    $scope.time.start = new Date(now - 604800000);
    $scope.time.end = new Date(now);

    // bounce users without Admin or Owner permissions
    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role == 'member')
        $location.path('/feed');
    });

    $scope.toggleMember = function(uid){
      var id = String(uid);
      //check if uid is in arr
      var x = _.findIndex(users, function(o) { return o == uid;});
      console.log(x);
      if(x != -1){
        //if so remove it from arr
        _.remove(users,function(o) { return o == uid;});
        //remove active class to element
        $("#"+id).toggleClass("active");

      }else{
        //if not add it
        users.push(uid);
        //add active class to element
        $("#"+id).toggleClass("active");

      }
      console.log(users);
    }

    $scope.getTasks = function(){
      console.log($scope.time);
      $scope.returnValues = {};
      console.log($scope.catSelect);
      for (var i = 0; i < users.length; i++) {
        getData(users[i],$scope.catSelect);
      }
    };

    $scope.exportData = function(){
      console.log($scope.returnValues);
      var dict = {}
      _.forEach(users,function(value){
        dict[value] = $scope.team.members[value];
      });

      console.log($scope.returnValues,dict);

      //Package for transport.
      var p = {
        data: $scope.returnValues,
        dict: dict,
        cat: $scope.team.categoryObj
      }
      console.log(p);
      $http.post('/api/downloads',{hose:p}).then(function(res){
        console.log(res);
        //window.open("/api/downloads");
        $http.get('/api/downloads',{file:'file'}).then(function(res){
          //console.log(res);
          var file = new Blob([ res.data ], {
                        type : 'application/csv'
                    });
                    //trick to download store a file having its URL
                    var fileURL = URL.createObjectURL(file);
                    var a         = document.createElement('a');
                    a.href        = fileURL;
                    a.target      = '_blank';
                    a.download    = 'export.csv';
                    document.body.appendChild(a);
                    a.click();
        })
      })
    }

    function getData(user,cat){
      var x = user;
      var s = new Date($scope.time.start).getTime();//start time
      var e = new Date($scope.time.end).getTime();//end time
      if(cat){
        //With category
        FBRef.child('team').child(Phased.team.uid).child('statuses').orderByChild("cat").equalTo(cat).once('value',function(snap){
          var y = snap.val();
          var a = []

          //Remove all results out of scope of the time selected
          _.forOwn(y, function(value, key) {
            if((value.time > s && value.time < e) && value.user == x){
              a.push(value);
            }
          } );


          $scope.returnValues[x] = a;

        });
      }else{
        //With out category
        FBRef.child('team').child(Phased.team.uid).child('statuses').once('value',function(snap){
          var y = snap.val();
          var a = []

          //Remove all results out of scope of the time selected
          _.forOwn(y, function(value, key) {
            if((value.time > s && value.time < e) && value.user == x){
              a.push(value);
            }
          } );


          $scope.returnValues[x] = a;

        });
      }

    }






  });
