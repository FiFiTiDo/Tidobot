import {TFunction} from "i18next";
import { Token } from "typedi";
import Adapter from "./Adapters/Adapter";
import { Service } from "./Database/Entities/Service";

export type TranslationProvider = () => Promise<TFunction>;

export const ServiceToken = new Token<Service>("Service");
export const AdapterToken = new Token<Adapter>("Adapter");
export const TranslationProviderToken  = new Token<TranslationProvider>("Translation Function");