module.exports = function(sequelize, DataTypes) {
  var Champion = sequelize.define('champion', {
    riotId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    title: DataTypes.STRING,
    lore: DataTypes.TEXT
  }, {
    classMethods: {
      associate: function(models) {
        Champion.hasMany(models.position);
        Champion.hasMany(models.link);
      }
    }
  });

  return Champion;
};
