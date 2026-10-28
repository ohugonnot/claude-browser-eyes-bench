fetch('api/promotions.json').then(function (r) { if (r.ok) { return r.json(); } }).catch(function () {});

document.getElementById('btn-calcul').addEventListener('click', function () {
  document.getElementById('resultat').textContent = calculerTotal(3, 4);
});
