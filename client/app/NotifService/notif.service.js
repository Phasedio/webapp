'use strict'

angular.module('webappApp')
	.service('Notif', ['Phased', '$rootScope', function(Phased, $rootScope) {

		// the main notification stream, exposed to controller
		this.stream = [
			{
				title : 'First item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				time : 1445459283148,
				unread : true
			},
			{
				title : 'Second item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				time : 1445459283729,
				unread : true
			},
			{
				title : 'Third item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				time : 1445459288473,
				unread : false
			},
			{
				title : 'Fourth item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				time : 1445459288234,
				unread : false
			}
		];
		var mainStream = this.stream;

		/**
		*
		*	a manager for various streams 
		*	allows to clear all items from one stream without 
		*	clearing the main stream
		*
		*/
		var NotifStreamHolder = function() {
			var items = [];

			// clears items in stream
			this.clear = function() {
				while (items.length != 0) { 
					// remove from this stream
					var curItem = items.pop();

					// remove from main stream
					for (var i in mainStream) {
						if (curItem.time == mainStream[i].time) {
							mainStream.splice(i, 1);
							break;
						}
					}
				}
			}

			// adds an iteam to the stream
			this.addItem = function(item) {
				// check item properties
				var props = ['title', 'body', 'time'];
				for (var i in props) {
					if (!item[props[i]]) {
						return false;
					}
				}

				// add item
				items.push(item);
				mainStream.push(item);
			}

			this.getLength = function() {
				return items.length;
			}
		}

		/**
			The various streams that will be amalgamated to form the exposed notification stream
		**/
		var histStream = new NotifStreamHolder();


		/**
		*
		*	populates history stream from Phased.team.history
		*
		*	basically just formats the Phased.team.history objects
		*
		*/

		var populateHistStream = function() {
			histStream.clear();

			for (var i in Phased.team.history) {
				var curItem = Phased.team.history[i];
				var histItem = {
					title : Phased.team.members[curItem.user].name,
					img : Phased.team.members[curItem.user].pic,
					body : curItem.name,
					time : curItem.time
				}

				histStream.addItem(histItem);
			}
		}
		$rootScope.$on('Phased:history', populateHistStream);


	}]);