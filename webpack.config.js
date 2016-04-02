var path = require('path');
var webpack = require('webpack');

module.exports = {
	devtool: 'cheap-module-eval-source-map',
	entry: [
		'eventsource-polyfill',
		'webpack-hot-middleware/client',
		'./src/index'
	],
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'bundle.js',
		publicPath: '/static/'
	},
	plugins: [
		new webpack.HotModuleReplacementPlugin(),
		new webpack.NoErrorsPlugin()
	],
	module: {
		loaders: [
			{
				test: /\.js/,
				loader: 'babel',
				include: path.join(__dirname, 'src')
			},
			{
				test: /\.css/,
				loaders: ['style', 'css?modules&importLoaders=1&localIdentName=[local]___[name]__[has:base64:5]','postcss'],
			}
		]
	},
	postcss: [
		require('autoprefixer')
	]
};