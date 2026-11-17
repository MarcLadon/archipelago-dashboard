# Archipelago dashboard

Site statique pour consulter plus facilement le spoiler de la partie Archipelago : joueurs, jeu, checks listés, objets placés, destinataires et recherche/filtrage.

## Site en ligne

Après activation de GitHub Pages et le premier déploiement, la page sera disponible à :

https://marcladon.github.io/archipelago-dashboard/

## Publier avec GitHub Pages

Le workflow `.github/workflows/pages.yml` déploie le dossier `site/` et copie `Spoiler.txt` à la racine du site publié. Dans Settings → Pages, sélectionner GitHub Actions comme source. Le déploiement se déclenche aux changements sur main affectant le site, le spoiler ou le workflow.

## Fonctionnalités actuelles

- Chargement automatique du spoiler public `Spoiler.txt`
- Import manuel d’un autre spoiler
- Résumé des joueurs, jeux et emplacements du spoiler
- Filtres par joueur et recherche dans les noms d’emplacements / objets
- Affichage de l’objet placé et du joueur qui le recevra

## Limites

Cette version montre les placements du spoiler, pas les checks déjà réalisés en direct. Les conditions détaillées de déblocage varient selon le jeu et ne sont pas toutes contenues dans le spoiler. La connexion temps réel au serveur Archipelago est une évolution séparée.

## Données publiques

Le dépôt et le site étant publics, `Spoiler.txt` ainsi que les données du seed sont accessibles à tous. Le site charge le fichier publié et l’affiche dans le navigateur.
