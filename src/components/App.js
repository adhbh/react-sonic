import React from 'react';
import styles from './App.css';
import SonicSocket from './SonicSocket';
import SonicServer from './SonicServer';

export default class App extends React.Component {
	render () {
		const duration = 0.2;
		const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz ';
		const message = 'react is fun';
		return (
				<div className = {styles.content} >
					<h1 className = {styles.hello} >Hello React Sonic</h1>
					<SonicSocket alphabet={alphabet} charDuration = {duration} message = {message} />
					
					//On some other machine
					<SonicServer alphabet={alphabet} />
				</div>
			);
	}
}