module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'commonjs' // 在測試環境轉換為 CommonJS
    }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs'
        }]
      ]
    }
  }
}