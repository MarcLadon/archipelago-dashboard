# Archipelago dashboard

Tableau de bord statique pour consulter un spoiler Archipelago : joueurs, emplacements, objets placés et destinataires. Le site peut aussi se connecter à un serveur Archipelago pour afficher automatiquement les checks accomplis.

## Site en ligne

Après activation de GitHub Pages et le premier déploiement, la page est disponible à :

https://marcladon.github.io/archipelago-dashboard/

## Fonctionnalités

- Chargement automatique du spoiler public `Spoiler.txt` ou import manuel d’un autre spoiler.
- Résumé des joueurs, jeux et emplacements du spoiler, avec recherche et filtres.
- Connexion directe en WebSocket au serveur Archipelago pour recevoir les checks au moment où ils sont validés.
- Indicateur de progression par joueur et filtre des checks accomplis / à faire.

## Suivi des checks en direct

Dans la section **Checks en direct**, indiquez l’adresse `wss://` du serveur Archipelago et, si la salle le demande, son mot de passe. Le tableau de bord ouvre une connexion de suivi par joueur décrit dans le spoiler et utilise les paquets `Connected` et `RoomUpdate` pour afficher les emplacements vérifiés. Les noms et identifiants d’emplacements sont associés au moyen du Data Package fourni par le serveur.

Le client utilise les tags `Tracker` et `NoText`, ne demande pas les données de slot et n’envoie aucun paquet `LocationChecks`. Le mot de passe n’est pas enregistré dans le navigateur et n’est transmis qu’au serveur choisi. Ne saisissez pas de mot de passe si vous n’êtes pas certain de l’adresse du serveur. La prise en charge d’une connexion dépend également de la configuration et des règles du serveur; les erreurs d’authentification ou de TLS sont affichées dans la page.

Les checks sont reçus uniquement pendant que la page reste ouverte et connectée. Cette version ne sauvegarde pas la progression sur un serveur.

## Publier avec GitHub Pages

Le workflow `.github/workflows/pages.yml` déploie le dossier `site/` et copie `Spoiler.txt` à la racine du site publié. Dans **Settings → Pages**, sélectionner **GitHub Actions** comme source. Le workflow s’exécute après les modifications de `site/`, de `Spoiler.txt` ou du workflow.

## Données publiques

Le dépôt et le site étant publics, `Spoiler.txt` ainsi que les données du seed sont accessibles à tous. Le site charge le spoiler dans le navigateur; l’utilisation de la connexion live envoie au serveur saisi uniquement les messages nécessaires au protocole de suivi.
