import React from 'react';

const Champion = (props) => {
  const {riotId, name, iconSrc} = props;
  const styles = require('./Champion.scss');
  return (
    <li
      id={'champ' + name}
      data-championid={riotId}
      className={'col-lg-1 col-md-1 col-sm-2 col-xs-3 ' + styles.champion}>
      <img
        className="img-responsive championPortrait"
        src={iconSrc}>
      </img>
      <span
        className="label center-block championLabel label-default">
        {name}</span>
    </li>
  );
};

Champion.propTypes = {
  riotId: React.PropTypes.number.isRequired,
  name: React.PropTypes.string.isRequired,
  iconSrc: React.PropTypes.string.isRequired,
};

export default Champion;
