import React, {Component, PropTypes} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {load} from 'redux/modules/championList';
import {Champion} from 'components';

@connect(
    state => ({championList: state.championList.champions}),
    dispatch => bindActionCreators({load}, dispatch))
export default class ChampionList extends Component {
  static propTypes = {
    championList: PropTypes.array,
    load: PropTypes.func.isRequired
  }

  render() {
    const {championList} = this.props; // eslint-disable-line no-shadow
    const styles = require('./ChampionList.scss');
    return (
      <ul className={styles.champions}>
          {championList.map(function returnChampion(object) {
            return (
              <Champion
                riotId={object.riotId}
                name={object.name}
                iconSrc={object.championIcon.url}/>
              );
          })}
      </ul>
      );
  }
}
