import React from 'react';
import styles from './App.css';
import SonicSocket from './SonicSocket';
import SonicServer from './SonicServer';

export default class App extends React.Component {
	render () {
		const duration = 0.2;
		const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz ';
		const message = 'react sonic is fun';
		return (
				<div className = {styles.container} >
					<h1 className = {styles.hello} >React Sonic</h1>
					<div className={styles.box}>
						<div className={styles.inner}>
							<SonicSocket alphabet={alphabet} charDuration = {duration} message = {message} />
						</div>
						<div className={styles.inner}>
							<SonicServer alphabet={alphabet} />
						</div>
					</div>
				</div>
			);
	}
}