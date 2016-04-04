'use strict';

// first thing: remove .no-js from html
var rootEl = document.getElementsByTagName('html')[0];
rootEl.className = rootEl.className.split('no-js').join('');

angular.module('webappApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute',
  'ui.bootstrap',
  'ui.calendar',
  // 'angular-stripe',
  'credit-cards',
  'firebase',
  'angularMoment',
  'ngAnimate',
  'toaster',
  'angular-inview',
  'sly'
])
.constant('FURL', 'https://phaseddev.firebaseio.com/')
.run(['$rootScope', '$location', function runPhased($rootScope, $location) {
      $rootScope.$on("$routeChangeError", function(event, next, previous, error) {
        // We can catch the error thrown when the $requireAuth promise is rejected
        // and redirect the user back to the home page
        if (error === "AUTH_REQUIRED") {
          $location.path("/login");
        }
      });

      $rootScope.$on("$routeChangeSuccess", function(e, next) {
        $rootScope.route = next.$$route.originalPath.split('/')[1];
      });

      // various stages of loading
      $rootScope.$on('Phased:setup', function(){
        $rootScope.phasedSetup = true;
      });
      $rootScope.$on('Phased:meta', function(){
        $rootScope.phasedMeta = true;
      });
      $rootScope.$on('Phased:teamComplete', function(){
        $rootScope.phasedTeamComplete = true;
      });
      $rootScope.$on('Phased:membersComplete', function(){
        $rootScope.phasedMembersComplete = true;
      });
      $rootScope.$on('Phased:projectsComplete', function(){
        $rootScope.phasedProjectsComplete = true;
      });
      $rootScope.$on('Phased:statusesComplete', function(){
        $rootScope.phasedStatusesComplete = true;
      });
  }])

  .config(function configRoutesOtherwise($routeProvider, $locationProvider) {
    $routeProvider
      .otherwise({
        redirectTo: '/'
      });

    $locationProvider.html5Mode(true);
  })
  /**
  * filters tasks by status
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByStatus', function filterTaskByStatus() {
    return function(input, statusID) {
      if (!input) return input;
      if (!statusID) return input;
      var expected = ('' + statusID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  * filters tasks by category
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByCategory', function filterTaskByCategory() {
    return function(input, catID) {
      if (!input) return input;
      if (!catID) return input;
      var expected = ('' + catID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  * filters tasks by assignment
  *
  * (preface direction with ! to filter out users)
  */
  .filter('filterTaskByAssignment', function filterTaskByAssignment() {
    return function(input, direction, uid) {
      if (!input) return input;
      if (!direction) return input;
      // direction must be "to" or "by" AND have uid OR be "unassigned" or "delegated"
      if (
        !( (direction == 'to' || direction == 'by') && typeof uid !== 'undefined' )
        && (direction != 'unassigned' && direction != 'delegated')
        )
        return input;

      var result = {}; // output obj

      if (direction[0] === '!') {
        direction = direction.slice(1); // remove leading !
        // negative filter -- filter out tasks with uid
        angular.forEach(input, function(value, key) {
          if (direction == 'to' && uid != value.assigned_to) {
            result[key] = value;
          } else if (direction == 'by' && uid != value.assigned_by) {
            result[key] = value;
          } else if (direction == 'delegated' && !((value.assigned_by != value.assigned_to) && !(value.unassigned)) ) { // delegated if assigned to a different person
            result[key] = value;
          } else if (direction == 'unassigned' && !(value.unassigned)) {
            result[key] = value;
          }
        });
      } else {
        // only include tasks with uid
        angular.forEach(input, function(value, key) {
          if (direction == 'to' && uid == value.assigned_to) {
            result[key] = value;
          } else if (direction == 'by' && uid == value.assigned_by) {
            result[key] = value;
          } else if (direction == 'delegated' && (value.assigned_by != value.assigned_to) && !(value.unassigned) ) { // delegated if assigned to a different person
            result[key] = value;
          } else if (direction == 'unassigned' && value.unassigned) {
            result[key] = value;
          }
        });
      }

      return result;
    }
  })
  /**
  *
  * allows ordering an object as if it were an array,
  * at the cost of being able to access its original index
  * Adds a property 'key' with the original index to
  * address this
  *
  */
  .filter('orderObjectBy', function orderObjectBy() {
    return function(items, field, reverse) {
      var filtered = [];
      for (var i in items) {
        items[i].key = i;
        filtered.push(items[i]);
      }
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  })
  /**
  *
  * change a task history change code to plain text
  * (lookup allows for easier text changes later)
  *
  */
  .filter('historyType', ['Phased', function historyType(Phased) {
    return function(input) {
      var types = {};
      types[Phased.task.HISTORY_ID.CREATED] = "Task created";
      types[Phased.task.HISTORY_ID.ARCHIVED] = "Task archived";
      types[Phased.task.HISTORY_ID.UNARCHIVED] = "Task unarchived";
      types[Phased.task.HISTORY_ID.NAME] = "Task name changed";
      types[Phased.task.HISTORY_ID.DESCRIPTION] = "Task description changed";
      types[Phased.task.HISTORY_ID.ASSIGNEE] = "Task assignee changed";
      types[Phased.task.HISTORY_ID.DEADLINE] = "Task deadline changed";
      types[Phased.task.HISTORY_ID.CATEGORY] = "Task category changed";
      types[Phased.task.HISTORY_ID.PRIORITY] = "Task priority changed";
      types[Phased.task.HISTORY_ID.STATUS] = "Task status changed";

      return types[input] || input; // fail gracefully
    }
  }])

  /**
  * filters tasks by status
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByStatus', function filterTaskByStatus() {
    return function(input, statusID) {
      if (!input) return input;
      if (!statusID) return input;
      var expected = ('' + statusID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  * filters tasks by category
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByCategory', function filterTaskByCategory() {
    return function(input, catID) {
      if (!input) return input;
      if (!catID) return input;
      var expected = ('' + catID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  *
  * allows ordering an object as if it were an array,
  * at the cost of being able to access its original index
  * Adds a property 'key' with the original index to
  * address this
  *
  */
  .filter('orderObjectBy', function orderObjectBy() {
    return function(items, field, reverse) {
      var filtered = [];
      for (var i in items) {
        items[i].key = i;
        filtered.push(items[i]);
      }
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  })
  .filter('orderMembers', function orderMembers() {
    return function(items, field, reverse) {
      var filtered = [];
      for (var i in items) {
        items[i].key = i;
        items[i].lastUpdated = items[i].currentStatus.time;
        filtered.push(items[i]);
      }
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  })
  .filter('tel', function tel() {
    return function(tel) {
      var res = formatLocal('CA', tel);
      return res || tel;
    }
  })
  /*
    Basically a length property that will also count objects
  */
  .filter('length', function length(){
    return function(input) {
      return Object.keys(input).length;
    }
  })
  /*
    Gets updates for a user
  */
  .filter('updatesFor', function updatesFor() {
    return function(input, uid) {
      var out = {};
      // for each status
      for (var i in input) {
        // if both a user is specified and it matches the user, add to output array
        if (typeof uid == 'string' && input[i].user === uid) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    get updates during a specified period ('today' or 'week')
    1. sets after and before vars depending on period
    2. checks each update's time attribute to see if it's between them
  */
  .filter('updatesForTime', function updatesForTime() {
    // get midnight timestamp outside of returned function so we don't have to do the calculation each digest
    var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
    var midnight = new Date(today[2],today[1],today[0]).getTime();
    var tomorrow = midnight + 86400000;
    var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000 * 7);



    return function(input, since) {
      var out = {};
      var after, before;

      // 1. determine range
      if (since == 'today') {
        after = midnight;
        before = tomorrow;
      } else if (since == 'week') {
        after = weekOffSet;
        before = midnight;
      } else {
        return input;
      }

      // 2. check each update
      for (var i in input) {
        if (input[i].time >= after && input[i].time < before) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    gets a list of incomplete tasks assigned to a user
  */
  .filter('backlogFor', ['Phased', function backlogFor(Phased) {
    return function(input, uid) {
      var out = {};

      // for each task
      for (var i in input) {
        // if isn't finished and both a user is specified and it matches the user, add to output array
        if (input[i].status != Phased.task.STATUS_ID.COMPLETE &&
          (typeof uid == 'string' && input[i].assigned_to === uid)) {
          out[i] = input[i];
        }
      }

      return out;
    }
  }])
  /*
    gets a list of tasks assigned to a user
  */
  .filter('tasksFor', function tasksFor() {
    return function(input, uid) {
      var out = {};

      // for each task
      for (var i in input) {
        if (typeof uid == 'string' && input[i].assigned_to === uid) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    gets a list of tasks completed within a specified period ('today', 'week', or 'ever')
  */
  .filter('tasksCompletedForTime', ['Phased', function tasksCompletedForTime(Phased) {
    var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
    var midnight = new Date(today[2],today[1],today[0]).getTime();
    var tomorrow = midnight + 86400000;
    var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000 * 7);

    return function(input, since) {
      var out = {};
      var after, before;

      if (since == 'today') {
        after = midnight;
        before = tomorrow;
      } else if (since == 'week') {
        after = weekOffSet;
        before = midnight;
      } else if (since == 'ever') {
        after = 0;
        before = tomorrow;
      } else {
        return input;
      }

      // for each task
      for (var i in input) {
        if (input[i].status == Phased.task.STATUS_ID.COMPLETE &&
          input[i].completeTime >= after && input[i].completeTime < before) {
          out[i] = input[i];
        }
      }

      return out;
    }
  }])
  .filter('hostname', function hostname($document) {
  	return function (input) {
  		var parser = document.createElement('a');
  		parser.href = input;
  		return parser.hostname;
  	};
  })
;
