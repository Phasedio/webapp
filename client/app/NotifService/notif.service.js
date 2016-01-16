'use strict'

angular.module('webappApp')
	.service('Notif', function() {
		this.stream = [
			{
				title : 'First item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				unread : true
			},
			{
				title : 'Second item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				unread : true
			},
			{
				title : 'Third item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				unread : false
			},
			{
				title : 'Fourth item',
				body : 'This is the first item in a stream. This is some text that would be in the body of the stream ...',
				img : '',
				unread : false
			}
		];
	});