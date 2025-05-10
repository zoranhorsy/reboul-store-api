# Guide d'Utilisation des Stripe Payment Links

Ce document explique comment configurer, personnaliser et utiliser Stripe Payment Links après la synchronisation des produits.

## Table des matières

1. [Introduction aux Stripe Payment Links](#introduction-aux-stripe-payment-links)
2. [Prérequis](#prérequis)
3. [Accès au Dashboard Stripe](#accès-au-dashboard-stripe)
4. [Configuration des Payment Links](#configuration-des-payment-links)
5. [Personnalisation de l'expérience client](#personnalisation-de-lexpérience-client)
6. [Intégration sur le site Reboul](#intégration-sur-le-site-reboul)
7. [Analyse des performances](#analyse-des-performances)
8. [FAQ](#faq)

## Introduction aux Stripe Payment Links

Stripe Payment Links est une solution "no-code" qui vous permet de créer rapidement des liens de paiement pour vos produits. Ces liens peuvent être partagés par email, sur les réseaux sociaux, ou intégrés sur votre site web.

**Avantages :**
- Aucun développement nécessaire
- Mise en place rapide
- Expérience de paiement optimisée
- Gestion simplifiée des produits

## Prérequis

Avant de commencer à utiliser les Payment Links, assurez-vous que:
- La synchronisation des produits a été effectuée avec succès
- Vous disposez d'un accès administrateur au Dashboard Stripe
- Les produits apparaissent correctement dans le catalogue Stripe

## Accès au Dashboard Stripe

1. Connectez-vous à votre compte Stripe: https://dashboard.stripe.com/
2. Assurez-vous d'être dans le bon environnement (Test/Production)
3. Dans le menu de gauche, naviguez vers "Produits" pour vérifier que vos produits ont bien été synchronisés

## Configuration des Payment Links

### Création d'un Payment Link simple

1. Dans le Dashboard Stripe, accédez à **Paiements > Payment Links**
2. Cliquez sur **Créer un lien de paiement**
3. Sélectionnez un produit dans votre catalogue
4. Configurez les options de base:
   - Prix et quantité
   - Devises acceptées (EUR par défaut)
   - URL de redirection après paiement

### Configuration avancée

Vous pouvez également configurer des options avancées:

1. **Options de paiement**
   - Paiement unique ou récurrent
   - Méthodes de paiement acceptées (cartes, Apple Pay, Google Pay, etc.)

2. **Informations client**
   - Champs obligatoires (email, adresse, téléphone)
   - Questions personnalisées

3. **Options de livraison**
   - Méthodes de livraison (standard, express, retrait en magasin)
   - Frais de livraison par méthode

4. **Codes promotionnels**
   - Activation/désactivation des codes promo
   - Création de codes spécifiques pour ce lien

## Personnalisation de l'expérience client

### Personnalisation visuelle

1. Dans **Paramètres > Branding**, configurez:
   - Logo de votre entreprise
   - Couleurs primaires et secondaires
   - Polices d'écriture

2. Personnalisez les textes:
   - Message d'accueil
   - Confirmation de paiement
   - Emails de confirmation

### Personnalisation des emails

1. Dans **Paramètres > Emails**, configurez:
   - Template d'email de confirmation
   - Email de reçu
   - Notifications de livraison

## Intégration sur le site Reboul

### Intégration des boutons d'achat

Plusieurs méthodes sont disponibles pour intégrer les Payment Links sur votre site:

1. **Bouton "Acheter maintenant"**
   ```html
   <a href="https://buy.stripe.com/votre_lien_unique" class="stripe-payment-link">
     Acheter maintenant
   </a>
   ```

2. **QR Code pour affichage en magasin**
   - Générez un QR code dans le Dashboard Stripe
   - Téléchargez-le et affichez-le en magasin

3. **Intégration dynamique**
   ```javascript
   // Récupérer l'ID du produit actuel
   const productId = getCurrentProductId();
   
   // Récupérer le lien de paiement correspondant
   fetch(`/api/stripe/payment-link?product_id=${productId}`)
     .then(response => response.json())
     .then(data => {
       document.getElementById('buy-button').href = data.paymentLink;
     });
   ```

## Analyse des performances

### Tableaux de bord et rapports

Stripe fournit des outils d'analyse puissants:

1. **Dashboard de paiements**
   - Suivi des ventes en temps réel
   - Taux de conversion
   - Panier moyen

2. **Rapports personnalisés**
   - Performances par produit
   - Analyse des abandons
   - Efficacité des codes promo

### Export des données

Pour une analyse plus approfondie, vous pouvez exporter les données:

1. Dans le Dashboard Stripe, accédez à **Rapports**
2. Configurez les paramètres du rapport (période, produits, etc.)
3. Exportez au format CSV ou PDF

## FAQ

**Q: Comment mettre à jour les produits dans Stripe Payment Links?**
R: Les produits sont automatiquement mis à jour grâce au script de synchronisation. Il n'est pas nécessaire de recréer manuellement les liens.

**Q: Est-il possible de créer un lien pour un panier contenant plusieurs produits?**
R: Oui, lors de la création du lien, vous pouvez ajouter plusieurs produits à un même lien.

**Q: Comment suivre l'origine des ventes?**
R: Utilisez des paramètres UTM dans vos liens pour suivre l'origine des ventes dans vos outils d'analyse.

**Q: Que se passe-t-il si un produit est épuisé?**
R: Si la synchronisation est correctement configurée, le stock sera mis à jour et le produit apparaîtra comme indisponible.

**Q: Comment personnaliser les emails de confirmation?**
R: Dans le Dashboard Stripe, accédez à **Paramètres > Emails** pour personnaliser tous les templates d'emails.

---

Pour toute question supplémentaire, consultez la [documentation officielle de Stripe](https://stripe.com/docs/payment-links) ou contactez l'équipe technique de Reboul. 