import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Message, {Response} from "../Chat/Message";
import Event, {EventArguments} from "../Systems/Event/Event";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Key} from "../Utilities/Translator";
import Convert, {ValueSettingsTypes} from "../Utilities/Convert";
import {injectable} from "inversify";
import Logger from "../Utilities/Logger";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import {objectHasProperties} from "../Utilities/ObjectUtils";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import minimist = require("minimist-string");
import EventSystem from "../Systems/Event/EventSystem";

