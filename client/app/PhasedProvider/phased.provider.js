angular.module('webappApp')
  .provider('Phased', function() {

    /**
      
      PhasedProvider provides a single access point for interacting with the Phased FireBase server.

      It provides
        - methods for adding, updating, or removing data from the server
        - 'live' properties reflecting the data in the database (courtesy of FBRef.on())
        - 'static' properties reflecting Phased constants (such as task priority names and IDs)

      Note on FireBase async:
        Methods can be called from controllers that request data from Auth before the 
      FireBase AJAX requests (called in AuthProvider.doAfterAuth()) that gather that data are complete. To 
      circumvent this, methods that need this data are registered as callbacks (via registerAsync) which
      are either fired immediately if doAfterAuth is complete (ie, PHASED_SET_UP == true) or at the end of
      this.init() if not (via doAsync).
        Because of this, all methods exposed by PhasedProvider must be registered with registerAsync.

      Current functionality:
        - Tasks (in progress)

      Pending functionality:
        - Feed page

    **/

    /**
    * Internal vars
    */
    var PHASED_SET_UP = false; // set to true after team is set up and other fb calls can be made
    var req_callbacks = []; // filled with operations to complete when PHASED_SET_UP

    /**
    * External vars
    * (exposed by this.$get())
    */
    var _Auth,
      _viewType = 'notPaid',  // Phased.viewType
      _billingInfo, // Phased.billing
      _taskPriorities, // Phased.taskPriorities
      _taskStatuses, // Phased.taskStatuses
      _team = {}, // Phased.team
      _currentUser = '', // Phased.user
      FBRef = ''; // Phased.FBRef

    /**
    *
    * configure the provider and begin requests
    * called in AuthProvider's doAfterAuth callback,
    * which must be set in a .config() block
    *
    */

    this.init = function(Auth) {
      _Auth = Auth;
      _currentUser = Auth.user;
      _team.name = Auth.currentTeam;

      checkPlanStatus();
      setUpTeamMembers();
      getCategories();
      getTaskPriorities();
      getTaskStatuses();

      // things that can only be done after async operations are finished
      doAsync();
    }

    /**
    *
    * constructs the provider itself
    * exposes data about the team, current user, view type,
    * and a FireBase reference, as well as numerous methods
    *
    */
    this.$get = function() {
      return {
        user : _currentUser,
        team : _team,
        viewType : _viewType,
        billing : _billingInfo,
        taskPriorities : _taskPriorities,
        taskStatuses : _taskStatuses,
        FBRef : FBRef,
        watchAssignments : _watchAssignments
      }
    };

    // must be called in config or everything breaks
    this.setFBRef = function(FURL) {
      FBRef = new Firebase(FURL);
    }

    /**
    *
    * registerAsync
    * if Phased is already set to go, do the thing
    * otherwise, add it to the list of things to do
    *
    */
    var registerAsync = function(callback, args) {
      if (PHASED_SET_UP)
        callback(args);
      else
        req_callbacks.push({callback : callback, args : args });
    }

    /**
    *
    * doAsync
    * executes all registered callbacks
    *
    */
    var doAsync = function() {
      for (var i in req_callbacks) {
        req_callbacks[i].callback(req_callbacks[i].args || undefined);
      }
      PHASED_SET_UP = true;
    }



    /**
    **
    **  METADATA GATHERING FUNCTIONS
    **  In which app constants are gathered from server
    **  as well as information about the current user and team
    **
    **/

    // 1. static data

    // gathers task Priorities, adds to _taskPriorities
    var getTaskPriorities = function() {
      FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
        tP = tP.val();
        // console.log('taskPriorities', tP);
        if (typeof tP !== 'undefined' && tP != null){
          // assign keys to obj, set obj to $scope
          for (var i in tP) {
            tP[i]['key'] = i;
          }
          _taskPriorities = tP;
        } else {
          // no status priorities exist, add defaults
          var obj = [
            { name : 'High' },
            { name : 'Medium' },
            { name : 'Low' }
          ];

          // save to db
          FBRef.child('taskPriorities').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
            tP = tP.val();
            // assign keys to obj and set to _taskPriorities
            for (var i in tP) {
              tP[i]['key'] = i;
            }
            _taskPriorities = tP;
          });
        }
      });
    }

    // gathers task Statuses, adds to _taskStatuses
    var getTaskStatuses = function() {
      FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
        tS = tS.val();
        // console.log('taskStatuses', tS);
        if (typeof tS !== 'undefined' && tS != null){
          // assign keys to obj, set obj to $scope
          for (var i in tS) {
            tS[i]['key'] = i;
          }
          _taskStatuses = tS;
          // console.log('_taskStatuses', _taskStatuses);
        } else {
          // no status types exist, add defaults
          var obj = [
            { name : 'In Progress' },
            { name : 'Complete' },
            { name : 'Assigned' }
          ];

           // save to db
          FBRef.child('taskStatuses').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
            tS = tS.val();
            // assign keys to obj and set to _taskStatuses
            for (var i in tS) {
              tS[i]['key'] = i;
            }
            _taskStatuses = tS;
            // console.log('_taskStatuses', _taskStatuses);
          });
        }
      });
    }


    // 2. dynamic data (logged in user & team)

    /**
    *
    * gather team data
    * 1. watches the team's tasks
    * 1.b  when a new task is posted, it refreshes the team membership
    *
    */
    var setUpTeamMembers = function() {
      // get members
      FBRef.child('team').child(_team.name).child('task').on('value', function(users) {
        users = users.val();
        _team.members = {};

        if (users) {
          for (var id in users) {
            // needs to be in function otherwise for loop screws up id
            (function(id, users) {
              FBRef.child('profile/' + id).once('value', function(data){
                data = data.val();
                if (!data) return;

                var style = false;
                if (users[id].photo){
                  style = "background:url("+users[id].photo+") no-repeat center center fixed; -webkit-background-size: cover;-moz-background-size: cover; -o-background-size: cover; background-size: cover";
                }
                var user = {
                  name : data.name,
                  pic : data.gravatar,
                  task : users[id].name,
                  time : users[id].time,
                  weather: users[id].weather,
                  city: users[id].city,
                  uid : id,
                  photo: style
                };

                _team.members[id] = user;
              });
            })(id, users);
          }
        }
      });
    }

    // gathers team categories data and adds to _team
    var getCategories = function() {
      var team = _Auth.currentTeam;
      FBRef.child('team').child(team).child('category').once('value', function(cat) {
        cat = cat.val();
        _team.categorySelect = [];

        if(typeof cat !== 'undefined' && cat != null){
          var keys = Object.keys(cat);
          _team.categoryObj = cat;
            for (var i = 0; i < keys.length; i++){
              var obj = {
                name : cat[keys[i]].name,
                color : cat[keys[i]].color,
                key : keys[i]
              }
              _team.categorySelect.push(obj);
            }
        } else {
          //they have no categories so add them
          var obj = [
            {
              name : 'Communication',
              color : '#ffcc00'
            },
            {
              name : 'Planning',
              color : '#5ac8fb'
            }
          ];
          FBRef.child('team/' + team + '/category').set(obj);
          FBRef.child('team/' + team + '/category').once('value', function(cat) {
            cat = cat.val();
            var keys = Object.keys(cat);
            _team.categoryObj = cat;
              for(var i = 0; i < keys.length; i++){
                var obj = {
                  name : cat[keys[i]].name,
                  color : cat[keys[i]].color,
                  key : keys[i]
                }
                _team.categorySelect.push(obj);
              }
          });
        }
      });
    }

    // checks current plan status
    // retrofitted from main.controller.js to avoid using $http
    // may need changing but polls backend ok.
    var checkPlanStatus = function() {
      FBRef.child('team').child(_Auth.currentTeam).once('value', function(data){
        var team = data.val();

        if (team.billing){
          _billingInfo = team.billing;

          $.post('./api/pays/find', {customer: team.billing.stripeid})
            .success(function(data){
              if (data.err) {
                console.log(data.err);
                // handle error
              }
              if (data.status == "active"){
                //Show thing for active
                _viewType = 'active';

              } else if (data.status == 'past_due' || data.status == 'unpaid'){
                //Show thing for problem with account
                _viewType = 'problem';
              } else if (data.status == 'canceled'){
                //Show thing for problem with canceled
                _viewType = 'notPaid';
              }
              console.log("viewType: " + _viewType);
            })
            .error(function(data){
              console.log(data);
            });
        } else {
          _viewType = 'notPaid';
        }
      });
    }

    /**
    **
    ** EXPOSED FUNCTIONS
    ** all registered as callbacks with registerAsync(),
    **
    **/

    /**
    *
    * sets up watchers for current users task assignments - to and by
    * and also unassigned tasks
    *
    *   - own assignments (to self or to others) assignments/to/(me)
    *   - assignments to me by others assignments/by/(me)
    *   - unassigned tasks assignments/un
    */
    var _watchAssignments = function(callbacks) {
      registerAsync(asyncWatchAssignments, callbacks);
    }

    var asyncWatchAssignments = function(callbacks) {
      var refString = 'team/' + _team.name + '/assignments';

      if ('all' in callbacks)
        FBRef.child(refString + '/all').on('value', callbacks.all);
      
      if ('to_me' in callbacks)
        FBRef.child(refString + '/to/' + _currentUser.uid).on('value', callbacks.to_me);
      
      if ('by_me' in callbacks)
        FBRef.child(refString + '/by/' + _currentUser.uid).on('value', callbacks.by_me);
      
      if ('unassigned' in callbacks)
        FBRef.child(refString + '/unassigned').on('value', callbacks.unassigned);
    };



  })
  .config(['PhasedProvider', 'FURL', 'AuthProvider', function(PhasedProvider, FURL, AuthProvider) {
    PhasedProvider.setFBRef(FURL);
    // configure phaseProvider as a callback to AuthProvider
    AuthProvider.setDoAfterAuth(PhasedProvider.init);
  }]);