import path from "path";
import webpack from "webpack";
import HTMLWebPlugin from "html-webpack-plugin";

const config: webpack.Configuration = {
  mode: "development",
  entry: path.resolve(__dirname, "src", "main.ts"),
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
    new HTMLWebPlugin({
      template: path.resolve(__dirname, "public", "index.html"),
    }),
  ],
};

export default config;
