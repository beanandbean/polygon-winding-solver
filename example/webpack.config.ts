import path from "path";
import webpack from "webpack";
import HTMLWebPlugin from "html-webpack-plugin";
import { env } from "process";

const production = env["NODE_ENV"] === "production";
const config: webpack.Configuration = {
  mode: production ? "production" : "development",
  entry: path.resolve(__dirname, "src", "main.ts"),
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: path.resolve(__dirname, "tsconfig.example.json"),
            },
          },
        ],
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
