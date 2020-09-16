import { Meteor } from 'meteor/meteor';
import _ from 'underscore';

import { Messages, Subscriptions, Rooms } from '../../../models';
import { callbacks } from '../../../callbacks';

const VOTE_TYPE = {
	UPVOTE: 'upvote',
	DOWNVOTE: 'downvote',
};

Meteor.methods({
	setVote({ voteType, msgId }) {
		if (!Meteor.userId()) {
			throw new Meteor.Error(203, 'User_logged_out');
		}

		const user = Meteor.user();

		const message = Messages.findOne({ _id: msgId });
		const room = Rooms.findOne({ _id: message.rid });

		if (voteType === VOTE_TYPE.UPVOTE
			&& message.votes[VOTE_TYPE.DOWNVOTE]
			&& message.votes[VOTE_TYPE.DOWNVOTE].find((x) => x === user.username)) { console.log('found already downvoted'); return false; }

		if (voteType === VOTE_TYPE.DOWNVOTE
			&& message.votes[VOTE_TYPE.UPVOTE]
			&& message.votes[VOTE_TYPE.UPVOTE].find((x) => x === user.username)) { console.log('found already upvoted'); return false; }

		if (room.ro && !room.reactWhenReadOnly) {
			if (room.unmuted.indexOf(user.username) === -1 || !Array.isArray(room.unmuted)) {
				return false;
			}
		}

		if (Array.isArray(room.muted) && room.muted.indexOf(user.username) !== -1) {
			return false;
		}

		if (!Subscriptions.findOne({ rid: message.rid })) {
			return false;
		}

		if (message.private) {
			return false;
		}

		if (message.votes && message.votes[voteType] && message.votes[voteType].indexOf(user.username) !== -1) {
			message.votes[voteType].splice(message.votes[voteType].indexOf(user.username), 1);

			if (message.votes.length === 0) {
				delete message.votes;
			}

			if (_.isEmpty(message.votes[voteType])) {
				delete message.votes[voteType];
			}
			Messages.setVote(msgId, message.votes);
			callbacks.run('setVote', msgId, voteType);
		} else {
			if (!message.votes) {
				message.votes = {};
			}
			if (!message.votes[voteType]) {
				message.votes[voteType] = [];
			}
			message.votes[voteType].push(user.username);

			Messages.setVote(msgId, message.votes);
			callbacks.run('setVote', msgId, voteType);
		}
	},
});
