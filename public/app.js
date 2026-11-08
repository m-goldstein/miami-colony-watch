import { temperatureLabel, temperatureState, TEMPERATURE_ALERTS } from './temperature.js';

(function () {
  'use strict';
  angular.module('colonyWatch', [])
    .directive('modalFocus', ['$timeout', function ($timeout) {
      return { link: function (scope, element) {
        var previous = document.activeElement;
        $timeout(function () { var first = element[0].querySelector('input,select,textarea,button'); if (first) first.focus(); });
        function key(event) {
          if (event.key === 'Escape') { scope.$apply(function () { scope.vm.close(); }); return; }
          if (event.key !== 'Tab') return;
          var focusable = Array.prototype.filter.call(element[0].querySelectorAll('button,input,select,textarea,a[href]'), function (e) { return !e.disabled && e.offsetParent !== null; });
          var first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        element.on('keydown', key);
        scope.$on('$destroy', function () { element.off('keydown', key); if (previous && previous.isConnected) previous.focus(); });
      } };
    }])
    .controller('Workspace', ['$http', '$interval', '$timeout', '$window', function ($http, $interval, $timeout, $window) {
      var vm = this, inFlight = false, toastTimer;
      vm.navigation = [{ id: 'overview', label: 'Overview', icon: 'grid' }, { id: 'colonies', label: 'Colonies', icon: 'pin' },
        { id: 'tasks', label: 'Field queue', icon: 'list' }, { id: 'census', label: 'Cat census', icon: 'cat' },
        { id: 'stations', label: 'Stations', icon: 'signal' }, { id: 'brief', label: 'Community brief', icon: 'book' }];
      var pages = vm.navigation.map(function (i) { return i.id; });
      vm.page = pages.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'overview';
      vm.selectedId = new URLSearchParams(location.search).get('colony') || null;
      vm.search = ''; vm.taskFilter = 'active'; vm.censusColony = ''; vm.catLimit = 20;
      vm.navigate = function (page) { vm.page = page; location.hash = page; $window.scrollTo({ top: 0, behavior: 'instant' }); };
      vm.pageTitle = function () { var p = vm.navigation.find(function (i) { return i.id === vm.page; }); return p ? p.label : 'Overview'; };
      vm.headline = function () { return { overview: 'Every colony, on your radar.', colonies: 'One network. Many little lives.', tasks: 'Turn a signal into a visit.', census: 'Know the cats behind the count.', stations: 'From the workbench to the field.', brief: 'Better care starts with context.' }[vm.page]; };
      vm.subtitle = function () { return { overview: 'Food, field updates, and the small signals that need a human response.', colonies: 'A shared picture of food reserves, local conditions, and caregiver visits.', tasks: 'The right person, in the right place, with the information they need.', census: 'Individual identities and checked records, shared across your team.', stations: 'Calibrate the hardware, record the checks, and keep the connection healthy.', brief: 'The real community challenges behind this fictional pilot.' }[vm.page]; };
      vm.refresh = function () {
        if (inFlight) return;
        inFlight = true;
        return $http.get('/api/state').then(function (r) {
          vm.state = r.data; vm.error = '';
          vm.activityEntries = vm.state.observations.map(function (o) { return Object.assign({ kind: 'observation' }, o); }).concat(
            vm.state.visits.map(function (v) { return Object.assign({ kind: 'visit', text: v.catsSeen + ' cats seen. ' + (v.foodRefilled ? 'Food refilled. ' : '') + (v.waterChanged ? 'Fresh water provided. ' : '') + v.notes }, v); })
          ).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
          if (!vm.selectedId || !vm.state.colonies.some(function (c) { return c.id === vm.selectedId; })) vm.selectedId = vm.state.colonies[0] && vm.state.colonies[0].id;
        }).catch(function () { vm.error = 'The local service is unavailable. Displayed readings may be old. Check npm start, then retry.'; })
          .finally(function () { inFlight = false; });
      };
      vm.age = function (value) {
        if (!value) return 'Not recorded';
        var seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        return Math.floor(seconds / 86400) + 'd ago';
      };
      vm.colonyName = function (id) { var c = vm.state && vm.state.colonies.find(function (item) { return item.id === id; }); return c ? c.name : 'Unlinked colony'; };
      vm.selectedColony = function () { return vm.state && vm.state.colonies.find(function (c) { return c.id === vm.selectedId; }); };
      vm.selectColony = function (colony) { vm.selectedId = colony.id; vm.notify('Focus colony: ' + colony.name); };
      vm.filteredColonies = function () { var q = vm.search.toLowerCase(); return vm.state.colonies.filter(function (c) { return (c.name + ' ' + c.neighborhood).toLowerCase().indexOf(q) >= 0; }); };
      vm.foodLabel = function (device) { return !vm.error && device && device.measurements.foodPercent !== null ? device.measurements.foodPercent + '%' : 'Unknown'; };
      vm.foodLow = function (d) { return !!(!vm.error && d && d.measurements.fresh && d.measurements.foodPercent !== null && d.measurements.foodPercent <= d.calibration.foodLowPercent); };
      vm.isWet = function (d) { return !!(d && d.measurements.fresh && (d.measurements.wet || d.measurements.waterPercent >= d.calibration.waterAlertPercent)); };
      vm.temperatureLabel = function (d) { return temperatureLabel(!vm.error && d && d.measurements.fresh ? d.measurements.temperatureC : null); };
      vm.temperatureAlert = function (d) { return TEMPERATURE_ALERTS[temperatureState(!vm.error && d && d.measurements.fresh ? d.measurements.temperatureC : null)]?.badge || 'No temperature alert'; };
      vm.temperatureRisk = function (d) { return !!(!vm.error && d && d.measurements.fresh && ['hot', 'cold', 'freezing'].includes(d.measurements.temperatureStatus)); };
      vm.weatherLabel = function (d) {
        if (vm.error || !d || !d.measurements.fresh) return 'No fresh reading';
        if (d.measurements.waterPercent >= d.calibration.waterAlertPercent) return 'Standing water';
        return d.measurements.wet ? 'Rain surface wet' : 'Surfaces dry';
      };
      vm.openTasks = function () { return vm.state.tasks.filter(function (t) { return t.status !== 'completed'; }).sort(function (a, b) { return (a.severity === 'urgent' ? 0 : 1) - (b.severity === 'urgent' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt); }); };
      vm.filteredTasks = function () { return vm.state.tasks.filter(function (t) { return vm.taskFilter === 'all' || (vm.taskFilter === 'completed' ? t.status === 'completed' : t.status !== 'completed'); }).sort(function (a, b) { return (a.severity === 'urgent' ? 0 : 1) - (b.severity === 'urgent' ? 0 : 1); }); };
      vm.taskIcon = function (type) { return { food: 'bowl', water: 'cloud', rain: 'cloud', offline: 'signal', stale: 'signal', sonar: 'signal', tnvr: 'cat' }[type] || 'list'; };
      vm.filteredCats = function () { return vm.state.cats.filter(function (cat) { return !vm.censusColony || cat.colonyId === vm.censusColony; }); };
      vm.colonyCats = function (id) { return vm.state ? vm.state.cats.filter(function (cat) { return cat.colonyId === id; }) : []; };
      vm.activities = function () {
        return (vm.activityEntries || []).filter(function (entry) { return entry.colonyId === vm.selectedId; });
      };
      vm.demoDevices = function () { return vm.state ? vm.state.devices.filter(function (d) { return d.demo; }) : []; };
      vm.checkCount = function (d) { return [d.sitePermission, d.benchPassed, d.weatherProtected].filter(Boolean).length; };
      vm.chartPoints = function (d) {
        if (!d || !d.history || !d.history.length) return '';
        var history = d.history;
        return history.map(function (p, i) { return p.food === null ? null : (i * 420 / Math.max(1, history.length - 1)).toFixed(1) + ',' + (100 - p.food * 0.8).toFixed(1); }).filter(Boolean).join(' ');
      };
      var defaultCalibration = { foodEmptyCm: 30, foodFullCm: 5, foodLowPercent: 25, waterDryRaw: 100, waterWetRaw: 800, waterAlertPercent: 60, rainDryRaw: 900, rainWetRaw: 250, rainActiveLow: true };
      vm.open = function (type) {
        vm.formError = ''; vm.modal = type;
        vm.form = { colonyId: vm.selectedId || (vm.state.colonies[0] && vm.state.colonies[0].id), author: '', catsSeen: 0, notes: '' };
        if (type === 'scenario') vm.form = { deviceId: vm.demoDevices()[0].id, scenario: 'low-food' };
        if (type === 'station') Object.assign(vm.form, { name: 'Field station', lifecycle: 'bench', calibration: angular.copy(defaultCalibration), sitePermission: false, benchPassed: false, weatherProtected: false });
        if (type === 'colony') vm.form = { name: '', neighborhood: '', caretaker: '', notes: '', stormPlan: '', sitePermission: false };
      };
      vm.openTask = function (task) { vm.open('task'); vm.form = angular.copy(task); };
      vm.openCat = function (cat) { vm.open('cat'); vm.form = angular.copy(cat); vm.form.evidence = ''; };
      vm.editStation = function (device) { vm.open('station'); vm.form = angular.copy(device); };
      vm.close = function () { if (vm.saving) return; vm.modal = null; vm.credentials = ''; vm.formError = ''; };
      vm.modalTitle = function () { return { visit: 'Log a field visit', observation: 'Share a field observation', colony: 'Add a colony', task: 'Manage the field task', cat: 'Update a TNVR record', scenario: 'Try a sensor scenario', station: vm.form && vm.form.id ? 'Configure station' : 'Provision a station', credentials: 'Your station is provisioned' }[vm.modal]; };
      vm.notify = function (message) { vm.toast = message; if (toastTimer) $timeout.cancel(toastTimer); toastTimer = $timeout(function () { vm.toast = ''; }, 4200); };
      vm.submit = function () {
        if (vm.saving) return;
        vm.saving = true; vm.formError = '';
        var type = vm.modal, f = angular.copy(vm.form), method = 'post', path;
        if (type === 'visit') path = '/api/visits';
        if (type === 'observation') path = '/api/observations';
        if (type === 'colony') path = '/api/colonies';
        if (type === 'scenario') path = '/api/demo/scenario';
        if (type === 'task') { path = '/api/tasks/' + f.id; method = 'patch'; }
        if (type === 'cat') { path = '/api/cats/' + f.id; method = 'patch'; }
        if (type === 'station') { path = '/api/devices' + (f.id ? '/' + f.id : ''); method = f.id ? 'patch' : 'post'; }
        $http[method](path, f).then(function (r) {
          if (type === 'station' && r.data.deviceKey) {
            vm.credentials = 'DEVICE_ID=' + r.data.device.id + '\nDEVICE_API_KEY=' + r.data.deviceKey + '\nSERIAL_PORT=/dev/ttyACM0\nAPI_URL=http://127.0.0.1:3000';
            vm.modal = 'credentials';
          } else {
            vm.modal = null;
            vm.notify(type === 'scenario' ? 'Simulated reading saved. The field queue is updated.' : 'Saved to your local workspace.');
          }
          return vm.refresh();
        }).catch(function (error) { vm.formError = error.data && error.data.error || 'Could not save. Check the local service and try again.'; })
          .finally(function () { vm.saving = false; });
      };
      vm.copyCredentials = function () {
        if (!$window.navigator.clipboard) { vm.notify('Select and copy the settings above.'); return; }
        $window.navigator.clipboard.writeText(vm.credentials).then(function () { $timeout(function () { vm.notify('Gateway settings copied.'); }); }).catch(function () { $timeout(function () { vm.notify('Select and copy the settings above.'); }); });
      };
      vm.refresh();
      $interval(vm.refresh, 5000);
      $window.addEventListener('hashchange', function () { var p = location.hash.slice(1); if (pages.indexOf(p) >= 0) $timeout(function () { vm.page = p; }); });
    }]);
}());
