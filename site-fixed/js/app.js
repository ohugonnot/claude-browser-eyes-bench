fetch('api/promotions.json').then(function (r) { if (r.ok) { return r.json(); } }).catch(function () {});

function calculerTotal(a, b) {
  return a + b;
}

document.getElementById('btn-calcul').addEventListener('click', function () {
  document.getElementById('resultat').textContent = calculerTotal(3, 4);
});
