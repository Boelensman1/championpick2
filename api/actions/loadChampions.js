// load project files
import models from '../../models';


export default function loadChampions() {
  return new Promise((resolve) => {
    // find multiple entries
    models.champion.findAll().then(function(champions) {
      // projects will be an array of all Project instances
      resolve({
        champions: champions
      });
    });
  });
}
