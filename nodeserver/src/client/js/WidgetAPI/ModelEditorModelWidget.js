"use strict";

define(['./../../../common/LogManager.js',
    './../../../common/EventDispatcher.js',
    './../util.js',
    './WidgetBase.js',
    './../NotificationManager.js'], function (logManager,
                                   EventDispatcher,
                                   util,
                                   WidgetBase,
                                   notificationManager) {

    //load its own CSS file (css/ModelEditorSVGWidget.css)
    util.loadCSS('css/ModelEditorModelWidget.css');

    var ModelEditorModelWidget = function (id) {
        var logger,
            self = this,
            territoryId,
            skinContent = {},
            refresh,
            noTitleValue = "Loading...";

        $.extend(this, new WidgetBase(id));

        //get logger instance for this component
        logger = logManager.create("ModelEditorModelWidget_" + id);

        this.initializeFromNode = function (node) {
            var newPattern;

            territoryId = self.project.reserveTerritory(self);

            //generate skin controls
            $(self.el).addClass("model");

            //node title
            self.skinParts.title = $('<div/>');
            self.skinParts.title.addClass("modelTitle");
            this.el.append(self.skinParts.title);

            //get content from node
            if (node) {
                skinContent.title = node.getAttribute(self.nodeAttrNames.name);
                self.setPosition(node.getAttribute(self.nodeAttrNames.posX), node.getAttribute(self.nodeAttrNames.posY), true);
            } else {
                skinContent.title = noTitleValue;
                self.setPosition(30, 30, true);
            }

            //apply content to controls
            self.skinParts.title.html(skinContent.title);

            //specify territory
            newPattern = {};
            newPattern[self.getId()] = { "children": 0 };
            self.project.addPatterns(territoryId, newPattern);
        };

        this.setPosition = function (pX, pY, silent) {
            var childNode;

            this.el.css("position", "absolute");
            this.el.css("left", pX);
            this.el.css("top", pY);

            //non silent means save pos back to database
            if (silent === false) {
                childNode = self.project.getNode(self.getId());
                if (childNode) {
                    logger.debug("Object position changed for id:'" + self.getId() + "', new pos:[" + pX + ", " + pY + "]");
                    childNode.setAttribute("attr", { "posX":  pX, "posY":  pY });
                }
            }

            if (self.parentWidget) {
                self.parentWidget.childBBoxChanged(self);
            }
        };

        this.addedToParent = function () {
            if (self.parentWidget) {
                self.parentWidget.childBBoxChanged(self);
            }
        };

        // PUBLIC METHODS
        this.onEvent = function (etype, eid) {
            if (eid === self.getId()) {
                switch (etype) {
                case "load":
                    refresh("insert", eid);
                    break;
                case "modify":
                    refresh("update", eid);
                    break;
                case "create":
                    //refresh("insert", eid);
                    break;
                case "delete":
                    //refresh("update", eid);
                    break;
                }
            }
        };

        refresh = function (eventType, nodeId) {
            var node = self.project.getNode(nodeId),
                newTitle;

            if (node) {
                //update of currently displayed node
                //- title might have changed
                //- position might have changed

                newTitle = node.getAttribute(self.nodeAttrNames.name);
                if (skinContent.title !== newTitle) {
                    self.skinParts.title.html(newTitle).hide().fadeIn('fast');
                    if (skinContent.title !== noTitleValue) {
                        notificationManager.displayMessage("Object title '" + skinContent.title + "' has been changed to '" + newTitle + "'.");
                    }
                    skinContent.title = newTitle;
                }

                self.setPosition(node.getAttribute(self.nodeAttrNames.posX), node.getAttribute(self.nodeAttrNames.posY), true);
            }
        };

        this.destroy = function () {
            //delete its own territory
            self.project.removeTerritory(territoryId);

            //finally remove itself from DOM
            this.el.remove();
        };
    };

    return ModelEditorModelWidget;
});